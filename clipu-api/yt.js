import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const run = promisify(execFile);

const YOUTUBE_URL_RE =
	/^https?:\/\/(www\.|m\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{11}/;

export function isValidYoutubeUrl(url) {
	return YOUTUBE_URL_RE.test(url);
}

// YouTube blocks datacenter IPs with "Sign in to confirm you're not a bot",
// so yt-dlp needs cookies from a logged-in (throwaway) account. Render mounts
// secret files read-only, but yt-dlp rewrites the jar after each run, so it
// works from a writable copy.
const COOKIES_SRC = process.env.COOKIES_FILE ?? '/etc/secrets/cookies.txt';
const COOKIES_PATH = path.join(os.tmpdir(), 'clipu-cookies.txt');

function cookieArgs() {
	if (!existsSync(COOKIES_SRC)) {
		console.warn(`no cookies at ${COOKIES_SRC}; YouTube will likely block requests`);
		return [];
	}
	copyFileSync(COOKIES_SRC, COOKIES_PATH);
	return ['--cookies', COOKIES_PATH];
}

export const COOKIE_ARGS = cookieArgs();

export async function getVideoInfo(url) {
	const { stdout } = await run(
		'yt-dlp',
		['-j', '--no-warnings', '--no-playlist', ...COOKIE_ARGS, url],
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
