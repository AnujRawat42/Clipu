import type { APIRoute } from 'astro';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { readdir, readFile, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { isValidYoutubeUrl } from '../../lib/yt';

const run = promisify(execFile);

export const prerender = false;

// ponytail: 10min clip cap keeps a single request bounded (no queue/worker pool yet);
// raise or move to a job queue if real usage needs longer clips.
const MAX_CLIP_SECONDS = 600;

export const POST: APIRoute = async ({ request }) => {
	const body = await request.json().catch(() => null);
	const { url, start, end, quality, format } = body ?? {};

	if (typeof url !== 'string' || !isValidYoutubeUrl(url)) {
		return new Response(JSON.stringify({ error: 'Invalid YouTube URL' }), { status: 400 });
	}
	if (
		typeof start !== 'number' ||
		typeof end !== 'number' ||
		start < 0 ||
		end <= start ||
		end - start > MAX_CLIP_SECONDS
	) {
		return new Response(JSON.stringify({ error: 'Invalid start/end range' }), { status: 400 });
	}
	if (format !== 'mp4' && format !== 'mp3') {
		return new Response(JSON.stringify({ error: 'format must be mp4 or mp3' }), { status: 400 });
	}
	if (format === 'mp4' && (typeof quality !== 'number' || quality <= 0)) {
		return new Response(JSON.stringify({ error: 'Invalid quality' }), { status: 400 });
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

		return new Response(buffer, {
			headers: {
				'Content-Type': format === 'mp3' ? 'audio/mpeg' : 'video/mp4',
				'Content-Disposition': `attachment; filename="clip.${format}"`,
			},
		});
	} catch {
		return new Response(JSON.stringify({ error: 'Clip failed' }), { status: 502 });
	}
};
