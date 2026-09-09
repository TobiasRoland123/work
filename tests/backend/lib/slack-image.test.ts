import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/image-proxy/route';
import { getSlackImageUrl } from '@/lib/slack/image';

const photo = 'https://avatars.slack-edge.com/team-user.jpg';
const request = (url: string) =>
  new NextRequest(`https://work.example/api/image-proxy?url=${encodeURIComponent(url)}`);

afterEach(() => vi.unstubAllGlobals());

describe('Slack-only profile photos', () => {
  it.each([
    photo,
    'https://secure.gravatar.com/avatar/user.png',
    'https://a.slack-edge.com/default-user.png',
  ])('accepts a Slack photo source: %s', (url) => {
    expect(getSlackImageUrl(url)).toBe(url);
  });

  it.each([
    null,
    undefined,
    '',
    'invalid',
    'https://hel1.your-objectstorage.com/workbucket/profile-images/old.webp',
    'https://avatars.slack-edge.com.attacker.example/photo.jpg',
    'http://avatars.slack-edge.com/photo.jpg',
    'https://user:password@avatars.slack-edge.com/photo.jpg',
    'https://avatars.slack-edge.com:8443/photo.jpg',
  ])('uses the initials fallback for an unsupported source: %s', (url) => {
    expect(getSlackImageUrl(url)).toBeNull();
  });

  it('rejects bucket images without fetching them', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const response = await GET(
      request('https://hel1.your-objectstorage.com/workbucket/profile-images/old.webp')
    );
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('serves the Slack photo through the existing proxy', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response('photo-bytes', { headers: { 'Content-Type': 'image/jpeg' } })
      );
    vi.stubGlobal('fetch', fetch);
    const response = await GET(request(photo));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(await response.text()).toBe('photo-bytes');
    expect(fetch).toHaveBeenCalledWith(photo, expect.objectContaining({ redirect: 'error' }));
  });

  it('rejects non-image upstream responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Error</html>')));
    expect((await GET(request(photo))).status).toBe(404);
  });
});
