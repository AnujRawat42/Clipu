import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

const YOUTUBE_URL_RE =
	/^https?:\/\/(www\.|m\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{11}/;

export function isValidYoutubeUrl(url) {
	return YOUTUBE_URL_RE.test(url);
}

// PO-token provider dodges YouTube's datacenter-IP bot check without
// personal cookies. Points yt-dlp's bgutil-ytdlp-pot-provider plugin at the
// sidecar service (see clipu-api/pot-provider/ + README for deploy steps).
const POT_BASE_URL = process.env.POT_PROVIDER_URL ?? 'http://127.0.0.1:4416';
export const EXTRACTOR_ARGS = [
	'--extractor-args',
	`youtubepot-bgutilhttp:base_url=${POT_BASE_URL}`,
];

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
