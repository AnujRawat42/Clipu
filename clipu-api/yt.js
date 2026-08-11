import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

const YOUTUBE_URL_RE =
	/^https?:\/\/(www\.|m\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{11}/;

export function isValidYoutubeUrl(url) {
	return YOUTUBE_URL_RE.test(url);
}

// ponytail: android client spoof dodges YouTube's datacenter-IP bot check
// without cookies/proxy; if it stops working, next step is a PO-token
// provider sidecar (e.g. bgutil-ytdlp-pot-provider), not personal cookies.
export const EXTRACTOR_ARGS = ['--extractor-args', 'youtube:player_client=android'];

export async function getVideoInfo(url) {
	const { stdout } = await run(
		'yt-dlp',
		['-j', '--no-warnings', '--no-playlist', ...EXTRACTOR_ARGS, url],
		{ maxBuffer: 1024 * 1024 * 20 },
	);
	const info = JSON.parse(stdout);
	const qualities = [
		...new Set(
			(info.formats ?? [])
				.filter((f) => f.vcodec && f.vcodec !== 'none' && f.height)
				.map((f) => f.height),
		),
	].sort((a, b) => a - b);

	return {
		id: info.id,
		title: info.title,
		duration: info.duration,
		thumbnail: info.thumbnail,
		qualities,
	};
}
