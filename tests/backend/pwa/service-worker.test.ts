import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('../../../public/sw.js', import.meta.url), 'utf8');

function worker() {
  const listeners = new Map<string, (event: unknown) => void>();
  const offline = new Response('offline screen');
  const cache = {
    add: vi.fn().mockResolvedValue(undefined),
    match: vi.fn().mockResolvedValue(offline),
  };
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    keys: vi.fn().mockResolvedValue(['work-offline-v0', 'work-offline-v1', 'another-app']),
    delete: vi.fn().mockResolvedValue(true),
  };
  const fetch = vi.fn();
  const claim = vi.fn().mockResolvedValue(undefined);
  runInNewContext(source, {
    self: {
      location: { origin: 'https://work.example' },
      clients: { claim },
      addEventListener: (name: string, handler: (event: unknown) => void) =>
        listeners.set(name, handler),
    },
    caches,
    fetch,
    Request,
    Response,
    URL,
  });
  return { listeners, caches, cache, fetch, offline, claim };
}

function navigation(path = '/today', overrides = {}) {
  return { url: `https://work.example${path}`, method: 'GET', mode: 'navigate', ...overrides };
}

describe('offline service worker', () => {
  it('precaches only the anonymous offline document', async () => {
    const w = worker();
    const waitUntil = vi.fn();
    w.listeners.get('install')!({ waitUntil });
    await waitUntil.mock.calls[0][0];
    expect(w.cache.add).toHaveBeenCalledTimes(1);
    const request = w.cache.add.mock.calls[0][0] as Request;
    expect(request.url).toBe('https://work.example/offline.html');
    expect(request.credentials).toBe('omit');
  });

  it('returns a network response without caching colleague data', async () => {
    const w = worker();
    const response = new Response('private colleague data');
    w.fetch.mockResolvedValue(response);
    const respondWith = vi.fn();
    w.listeners.get('fetch')!({ request: navigation(), respondWith });
    expect(await respondWith.mock.calls[0][0]).toBe(response);
    expect(w.caches.open).not.toHaveBeenCalled();
    expect(w.cache.add).not.toHaveBeenCalled();
  });

  it('shows the offline document only when a document request fails', async () => {
    const w = worker();
    w.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    const respondWith = vi.fn();
    w.listeners.get('fetch')!({ request: navigation(), respondWith });
    expect(await respondWith.mock.calls[0][0]).toBe(w.offline);
    expect(w.cache.match).toHaveBeenCalledWith('/offline.html');
  });

  it('returns a network error when the offline document was evicted', async () => {
    const w = worker();
    w.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    w.cache.match.mockResolvedValue(undefined);
    const respondWith = vi.fn();
    w.listeners.get('fetch')!({ request: navigation(), respondWith });
    const response = await respondWith.mock.calls[0][0];
    expect(response.type).toBe('error');
    expect(response.status).toBe(0);
  });

  it('preserves server errors instead of masking them as offline', async () => {
    const w = worker();
    const response = new Response('server unavailable', { status: 503 });
    w.fetch.mockResolvedValue(response);
    const respondWith = vi.fn();
    w.listeners.get('fetch')!({ request: navigation(), respondWith });
    expect(await respondWith.mock.calls[0][0]).toBe(response);
    expect(w.cache.match).not.toHaveBeenCalled();
  });

  it.each([
    navigation('/api/auth/signin'),
    navigation('/api/users', { mode: 'cors' }),
    navigation('/today', { method: 'POST' }),
    navigation('/today', { mode: 'cors' }),
    navigation('/_next/static/chunk.js', { mode: 'no-cors' }),
    navigation('/', { url: 'https://slack.com/oauth/authorize' }),
  ])('leaves APIs, mutations, bundles, RSC and external requests alone: %j', (request) => {
    const w = worker();
    const respondWith = vi.fn();
    w.listeners.get('fetch')!({ request, respondWith });
    expect(respondWith).not.toHaveBeenCalled();
    expect(w.fetch).not.toHaveBeenCalled();
  });

  it('removes only old WØRK offline caches on activation', async () => {
    const w = worker();
    const waitUntil = vi.fn();
    w.listeners.get('activate')!({ waitUntil });
    await waitUntil.mock.calls[0][0];
    expect(w.caches.delete).toHaveBeenCalledExactlyOnceWith('work-offline-v0');
    expect(w.claim).toHaveBeenCalledOnce();
  });
});
