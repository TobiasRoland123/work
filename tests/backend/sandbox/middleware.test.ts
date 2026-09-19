import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const auth = vi.hoisted(() => vi.fn());
vi.mock('next-auth', () => ({ default: () => ({ auth }) }));

const { middleware } = await import('@/middleware');
const request = (path: string) => new NextRequest(new URL(path, 'http://127.0.0.1:3000'));

afterEach(() => {
  vi.unstubAllEnvs();
  auth.mockReset();
});

describe('/sandbox in middleware', () => {
  it('is reachable without a session outside production', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    auth.mockResolvedValue(null);
    const response = await middleware(request('/sandbox'));
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
    expect(auth).not.toHaveBeenCalled();
  });
  it('is treated like any other page in production builds', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    auth.mockResolvedValue(null);
    const response = await middleware(request('/sandbox'));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location')!).pathname).toBe('/login');
  });
  it('does not widen the service route allowlist', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    auth.mockResolvedValue(null);
    const response = await middleware(request('/api/sandbox'));
    expect(response.status).toBe(401);
  });
});
