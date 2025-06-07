/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

import { auth } from '@/auth';
import { fetchData, sendData } from '@/utils/fetchers'; // adjust path

describe('fetchers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:4000';
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('fetchData', () => {
    it('calls auth, fetches with correct headers, and returns json', async () => {
      // Use vi.mocked to get the typed mock function
      vi.mocked(auth).mockResolvedValue({ accessToken: 'mocktoken' } as any);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ foo: 'bar' }),
      });

      const result = await fetchData('test');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/test',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Content-type': 'application/json',
            Authorization: 'Bearer mocktoken',
          },
          cache: 'no-store',
        })
      );
      expect(result).toEqual({ foo: 'bar' });
    });

    it('throws if fetch response is not ok', async () => {
      vi.mocked(auth).mockResolvedValue({ accessToken: 'mocktoken' } as any);
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      });

      await expect(fetchData('fail')).rejects.toThrow('Failed to fetch fail');
    });

    it('falls back to localhost if NEXT_PUBLIC_APP_URL is not set', async () => {
      delete process.env.NEXT_PUBLIC_APP_URL;
      vi.mocked(auth).mockResolvedValue({ accessToken: 'mocktoken' } as any);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ fallback: true }),
      });

      const result = await fetchData('fallback');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/fallback',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Content-type': 'application/json',
            Authorization: 'Bearer mocktoken',
          },
          cache: 'no-store',
        })
      );
      expect(result).toEqual({ fallback: true });
    });

    it('omits Authorization header when no session is returned', async () => {
      vi.mocked(auth).mockResolvedValue(null as any);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ noAuth: true }),
      });

      const result = await fetchData('no-auth');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/no-auth',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Content-type': 'application/json',
          },
          cache: 'no-store',
        })
      );
      expect(result).toEqual({ noAuth: true });
    });
  });

  describe('sendData', () => {
    it('posts to correct endpoint with body and returns json', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 123 }),
      });

      const result = await sendData({ params: 'resource', body: { a: 1 } });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/resource',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-type': 'application/json',
          },
          cache: 'no-store',
          body: JSON.stringify({ a: 1 }),
        })
      );
      expect(result).toEqual({ id: 123 });
    });

    it('throws if fetch response is not ok', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      });

      await expect(sendData({ params: 'fail', body: { b: 2 } })).rejects.toThrow(
        'Failed to fetch fail'
      );
    });

    it('falls back to localhost if NEXT_PUBLIC_APP_URL is not set', async () => {
      delete process.env.NEXT_PUBLIC_APP_URL;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ fallback: true }),
      });

      const result = await sendData({ params: 'fallback', body: { test: 1 } });
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/fallback',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-type': 'application/json',
          },
          cache: 'no-store',
          body: JSON.stringify({ test: 1 }),
        })
      );
      expect(result).toEqual({ fallback: true });
    });
  });
});
