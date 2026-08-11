import express from 'express';
import cors from 'cors';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { readdir, readFile, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { isValidYoutubeUrl, getVideoInfo } from './yt.js';

const run = promisify(execFile);

// ponytail: 10min clip cap keeps a single request bounded (no queue/worker pool yet);
// raise or move to a job queue if real usage needs longer clips.
const MAX_CLIP_SECONDS = 600;

const app = express();
app.use(express.json());
app.use(
	cors({
		origin: process.env.ALLOWED_ORIGIN?.split(',') ?? '*',
	}),
);

app.post('/api/metadata', async (req, res) => {
	const { url } = req.body ?? {};

	if (typeof url !== 'string' || !isValidYoutubeUrl(url)) {
		return res.status(400).json({ error: 'Invalid YouTube URL' });
	}

	try {
		const info = await getVideoInfo(url);
		res.json(info);
	} catch {
		res.status(502).json({ error: 'Could not fetch video info' });
	}
});

app.post('/api/clip', async (req, res) => {
	const { url, start, end, quality, format } = req.body ?? {};

	if (typeof url !== 'string' || !isValidYoutubeUrl(url)) {
		return res.status(400).json({ error: 'Invalid YouTube URL' });
	}
	if (
		typeof start !== 'number' ||
		typeof end !== 'number' ||
		start < 0 ||
		end <= start ||
		end - start > MAX_CLIP_SECONDS
	) {
		return res.status(400).json({ error: 'Invalid start/end range' });
	}
	if (format !== 'mp4' && format !== 'mp3') {
		return res.status(400).json({ error: 'format must be mp4 or mp3' });
	}
	if (format === 'mp4' && (typeof quality !== 'number' || quality <= 0)) {
		return res.status(400).json({ error: 'Invalid quality' });
	}

	const outBase = path.join(os.tmpdir(), `clipu-${randomUUID()}`);
	const args = [
		'--download-sections',
		`*${start}-${end}`,
		'--no-playlist',
		'--no-warnings',
		...(format === 'mp3'
			? ['-x', '--audio-format', 'mp3']
			: [
					'-f',
					`bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]`,
					'--merge-output-format',
					'mp4',
				]),
		'-o',
		`${outBase}.%(ext)s`,
		url,
	];

	try {
		await run('yt-dlp', args, { timeout: 5 * 60 * 1000, maxBuffer: 1024 * 1024 * 20 });

		const dir = path.dirname(outBase);
		const base = path.basename(outBase);
		const match = (await readdir(dir)).find((f) => f.startsWith(base));
		if (!match) throw new Error('output file missing');

		const outPath = path.join(dir, match);
		const buffer = await readFile(outPath);
		await unlink(outPath).catch(() => {});

		res.set({
			'Content-Type': format === 'mp3' ? 'audio/mpeg' : 'video/mp4',
			'Content-Disposition': `attachment; filename="clip.${format}"`,
		});
		res.send(buffer);
	} catch {
		res.status(502).json({ error: 'Clip failed' });
	}
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`clipu-api listening on ${port}`));
