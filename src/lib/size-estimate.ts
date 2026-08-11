// kbps per resolution, rough h.264 progressive-download ballpark
const VIDEO_KBPS: Record<number, number> = {
	144: 100,
	240: 250,
	360: 500,
	480: 1000,
	720: 2500,
	1080: 5000,
	1440: 8000,
	2160: 16000,
};
const AUDIO_KBPS = 128;

export function estimateSizeMB(
	durationSec: number,
	format: 'mp4' | 'mp3',
	height?: number,
): number {
	const kbps = format === 'mp3' ? AUDIO_KBPS : (VIDEO_KBPS[height ?? 720] ?? 1000) + AUDIO_KBPS;
	return (kbps * 1000 * durationSec) / 8 / (1024 * 1024);
}
