import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchData, sendData } from '@/utils/fetchers';

const fetch = vi.fn<typeof globalThis.fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetch);
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://work.example');
  fetch.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('fetchers', () => {
  it('reads fresh API data with same-origin credentials', async () => {
    fetch.mockResolvedValue(new Response(JSON.stringify({ colleagues: ['Ada'] })));
    await expect(fetchData('users?day=2026-09-23')).resolves.toEqual({ colleagues: ['Ada'] });
    expect(fetch).toHaveBeenCalledExactlyOnceWith('https://work.example/api/users?day=2026-09-23', {
      method: 'GET',
      headers: { 'Content-type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
    });
  });

  it('posts a serialized body and returns the API result', async () => {
    fetch.mockResolvedValue(new Response(JSON.stringify({ id: 123 })));
    const body = { status: 'FROM_HOME', details: 'focus', days: ['2026-09-24'] };
    await expect(sendData({ params: 'status', body })).resolves.toEqual({ id: 123 });
    expect(fetch).toHaveBeenCalledExactlyOnceWith('https://work.example/api/status', {
      method: 'POST',
      headers: { 'Content-type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(body),
    });
  });

  it.each(['read', 'write'] as const)(
    'rejects unsuccessful %s responses before parsing the body',
    async (operation) => {
      const response = new Response('not JSON', { status: 403 });
      const json = vi.spyOn(response, 'json');
      fetch.mockResolvedValue(response);
      const result =
        operation === 'read' ? fetchData('private') : sendData({ params: 'private', body: {} });
      await expect(result).rejects.toThrow('Failed to fetch private');
      expect(json).not.toHaveBeenCalled();
    }
  );

  it.each(['read', 'write'] as const)(
    'uses the local API origin for %s when no origin is configured',
    async (operation) => {
      vi.stubEnv('NEXT_PUBLIC_APP_URL', undefined);
      fetch.mockResolvedValue(new Response(JSON.stringify({ local: true })));
      const result =
        operation === 'read' ? fetchData('users') : sendData({ params: 'users', body: {} });
      await expect(result).resolves.toEqual({ local: true });
      expect(fetch).toHaveBeenCalledExactlyOnceWith(
        'http://localhost:3000/api/users',
        expect.any(Object)
      );
    }
  );

  it.each(['read', 'write'] as const)(
    'preserves a network failure for a %s request',
    async (operation) => {
      const error = new TypeError('Network unavailable');
      fetch.mockRejectedValue(error);
      const result =
        operation === 'read' ? fetchData('users') : sendData({ params: 'users', body: {} });
      await expect(result).rejects.toBe(error);
    }
  );
});
