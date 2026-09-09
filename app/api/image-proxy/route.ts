import { NextRequest } from 'next/server';
import { getSlackImageUrl } from '@/lib/slack/image';

export const runtime = 'edge';
export async function GET(req: NextRequest) {
  const url = getSlackImageUrl(req.nextUrl.searchParams.get('url'));
  if (!url) return new Response('Unsupported image URL', { status: 400 });
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
