import { NextRequest } from 'next/server';

export const runtime = 'edge';
const slackImageHosts = ['avatars.slack-edge.com', 'secure.gravatar.com', 'a.slack-edge.com'];
export async function GET(req: NextRequest) {
  let url: URL;
  try {
    url = new URL(req.nextUrl.searchParams.get('url') ?? '');
  } catch {
    return new Response('Invalid image URL', { status: 400 });
  }
  const legacyHost = process.env.HETZNER_BUCKET_URL
    ? new URL(process.env.HETZNER_BUCKET_URL).hostname
    : 'hel1.your-objectstorage.com';
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    ![...slackImageHosts, legacyHost].includes(url.hostname)
  ) {
    return new Response('Unsupported image host', { status: 400 });
  }
  const imageRes = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(10000) });
  const type = imageRes.headers.get('content-type') ?? '';
  if (!imageRes.ok || !/^image\/(?:png|jpeg|webp|gif)(?:;|$)/.test(type))
    return new Response('Image not found', { status: 404 });
  return new Response(imageRes.body, {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
