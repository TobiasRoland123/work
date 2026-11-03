import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const auth = vi.hoisted(() => vi.fn());
vi.mock('next-auth', () => ({
  default: () => ({
    auth: (handler: (request: NextRequest) => Response) => async (request: NextRequest) =>
      handler(Object.assign(request, { auth: await auth() })),
  }),
}));

const { middleware } = await import('@/middleware');
const request = (path: string) => new NextRequest(new URL(path, 'https://work.example'));

afterEach(() => {
  auth.mockReset();
});

describe('PWA installation before sign-in', () => {
  it.each(['/manifest.webmanifest', '/sw.js', '/offline.html'])(
    'serves %s without authentication or redirects',
    async (path) => {
      auth.mockRejectedValue(new Error('Auth is unavailable'));
      const response = await middleware(request(path));
      expect(response.status).toBe(200);
      expect(response.headers.get('location')).toBeNull();
      expect(auth).not.toHaveBeenCalled();
    }
  );

  it('keeps private pages and APIs protected', async () => {
    auth.mockResolvedValue(null);
    const page = await middleware(request('/today'));
    expect(new URL(page.headers.get('location')!).pathname).toBe('/login');
    const api = await middleware(request('/api/users'));
    expect(api.status).toBe(401);
  });
});
