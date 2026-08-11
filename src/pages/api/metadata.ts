import type { APIRoute } from 'astro';
import { getVideoInfo, isValidYoutubeUrl } from '../../lib/yt';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
	const { url } = await request.json().catch(() => ({ url: undefined }));

	if (typeof url !== 'string' || !isValidYoutubeUrl(url)) {
		return new Response(JSON.stringify({ error: 'Invalid YouTube URL' }), { status: 400 });
	}

	try {
		const info = await getVideoInfo(url);
		return new Response(JSON.stringify(info), {
			headers: { 'Content-Type': 'application/json' },
		});
	} catch {
		return new Response(JSON.stringify({ error: 'Could not fetch video info' }), {
			status: 502,
		});
	}
};
