import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { decode, encode } from 'next-auth/jwt';

const secret = 'test-session-secret-that-is-long-enough-for-authjs';
const origin = 'https://work.example.test';
const cookieName = '__Secure-authjs.session-token';
const ninetyDays = 90 * 24 * 60 * 60;
let middleware: typeof import('@/middleware').middleware;

beforeAll(async () => {
  vi.stubEnv('AUTH_SECRET', secret);
  vi.stubEnv('AUTH_URL', origin);
  vi.stubEnv('AUTH_SLACK_ID', 'test-client');
  vi.stubEnv('AUTH_SLACK_SECRET', 'test-client-secret');
  ({ middleware } = await import('@/middleware'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
afterAll(() => vi.unstubAllEnvs());

const request = (path: string, token?: string) =>
  new NextRequest(new URL(path, origin), {
    headers: token ? { cookie: `${cookieName}=${token}` } : {},
  });
const createToken = (maxAge = ninetyDays) =>
  encode({
    token: { provider: 'slack', userId: 'test-user', sub: 'test-user' },
    secret,
    salt: cookieName,
    maxAge,
  });

function renewedToken(response: Response) {
  const cookie = response.headers
    .getSetCookie()
    .find((value) => value.startsWith(`${cookieName}=`));
  expect(cookie).toContain('HttpOnly');
  expect(cookie).toContain('Secure');
  expect(cookie).toContain('SameSite=Lax');
  return cookie!.split(';')[0].slice(cookieName.length + 1);
}

describe('persistent Slack sessions with real Auth.js middleware', () => {
  it.each(['/today', '/'])('renews the secure cookie after eight hours on %s', async (path) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-03T09:00:00Z'));
    const token = await createToken();
    vi.advanceTimersByTime(9 * 60 * 60 * 1000);

    const response = await middleware(request(path, token));
    expect(response.status).toBe(path === '/' ? 307 : 200);
    if (path === '/') expect(response.headers.get('location')).toBe(`${origin}/today`);
    const renewed = renewedToken(response);
    const payload = await decode({ token: renewed, secret, salt: cookieName });
    expect(payload?.userId).toBe('test-user');
    expect(payload?.exp).toBe(Math.floor(Date.now() / 1000) + ninetyDays);
    const cookie = response.headers
      .getSetCookie()
      .find((value) => value.startsWith(`${cookieName}=`));
    expect(cookie).toContain(`Expires=${new Date(Date.now() + ninetyDays * 1000).toUTCString()}`);

    // The browser can use the refreshed cookie on the following workday.
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect((await middleware(request('/today', renewed))).status).toBe(200);
  });

  it.each(['missing', 'expired', 'tampered'])(
    'rejects %s sessions for pages and APIs',
    async (kind) => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      let token: string | undefined;
      if (kind === 'expired') token = await createToken(-60);
      if (kind === 'tampered') token = `${(await createToken()).slice(0, -10)}tampered`;
      const page = await middleware(request('/today', token));
      expect(page.status).toBe(307);
      expect(page.headers.get('location')).toBe(`${origin}/login`);
      const api = await middleware(request('/api/me', token));
      expect(api.status).toBe(401);
      expect(await api.json()).toEqual({ error: 'Unauthorized' });
    }
  );

  it.each([
    '/api/auth',
    '/api/auth/callback/slack',
    '/api/auth/signout',
    '/api/check-users',
    '/api/slack/events',
    '/api/queues/slack-status',
    '/api/slack/process',
    '/api/slack/install',
    '/api/slack/install/callback',
  ])('bypasses session handling for %s', async (path) => {
    const response = await middleware(request(path, await createToken()));
    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it('keeps the login page public and redirects signed-out root visits', async () => {
    expect((await middleware(request('/login'))).status).toBe(200);
    const response = await middleware(request('/'));
    expect(response.headers.get('location')).toBe(`${origin}/login`);
  });

  it('keeps development redirects on the configured tunnel origin', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    vi.stubEnv('NODE_ENV', 'development');
    try {
      const response = await middleware(new NextRequest('http://localhost:3000/today'));
      expect(response.headers.get('location')).toBe(`${origin}/login`);
    } finally {
      vi.stubEnv('NODE_ENV', previousNodeEnv);
    }
  });
});
