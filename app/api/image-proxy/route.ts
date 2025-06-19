import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return new Response('Missing image URL', { status: 400 });
  }
  // Fetch the image from Hetzner
  const imageRes = await fetch(url);

  if (!imageRes.ok) {
    return new Response('Image not found', { status: 404 });
  }

  // Set cache headers for Vercel CDN (cache for 1 day)
  const headers = new Headers(imageRes.headers);
  headers.set('Cache-Control', 'public, max-age=86400, immutable');

  return new Response(imageRes.body, {
    status: imageRes.status,
    headers,
  });
}
