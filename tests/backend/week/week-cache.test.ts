import { AsyncLocalStorage } from 'node:async_hooks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getAllUsers = vi.hoisted(() => vi.fn());
vi.mock('@/lib/services/userService', () => ({ userService: { getAllUsers } }));

// Exercise Next 15's real unstable_cache serialization and key construction, with
// an in-memory incremental-cache storage adapter instead of a running server.
vi.stubGlobal('AsyncLocalStorage', AsyncLocalStorage);
const { getWeekOverview } = await import('@/lib/services/weekOverviewQuery');
const entries = new Map<string, { value: unknown; storedAt: number }>();
const get = vi.fn(async (key: string, options: { revalidate: number; tags: string[] }) => {
  const entry = entries.get(key);
  return (
    entry && {
      value: entry.value,
      isStale: Date.now() - entry.storedAt >= options.revalidate * 1000,
    }
  );
});
const set = vi.fn(async (key: string, value: unknown) => {
  entries.set(key, { value, storedAt: Date.now() });
});

beforeEach(() => {
  vi.useFakeTimers();
  entries.clear();
  vi.clearAllMocks();
  vi.stubGlobal('__incrementalCache', {
    generateSimpleCacheKey: async (key: string) => key,
    get,
    set,
  });
  const date = new Date('2026-10-30T09:00:00Z');
  const status = { time: date, startsAt: date, endsAt: date, announcedAt: date };
  getAllUsers.mockResolvedValue([
    { userId: 'colleague', status, week: [{ date: '2026-10-30', status, announcement: status }] },
  ]);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('shared week query cache', () => {
  it('reuses identical day inputs for five minutes and separates day/week variants', async () => {
    await getWeekOverview(['2026-10-30']);
    await getWeekOverview(['2026-10-30']);
    expect(getAllUsers).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ revalidate: 300, tags: ['week-overview'] })
    );
    await getWeekOverview(['2026-10-29', '2026-10-30']);
    expect(getAllUsers).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(299_000);
    await getWeekOverview(['2026-10-30']);
    expect(getAllUsers).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1_000);
    await getWeekOverview(['2026-10-30']);
    expect(getAllUsers).toHaveBeenCalledTimes(3);
  });

  it('restores status timestamps on both misses and JSON cache hits', async () => {
    const miss = await getWeekOverview(['2026-10-30']);
    const hit = await getWeekOverview(['2026-10-30']);
    expect(hit).toEqual(miss);
    expect(hit[0].status?.announcedAt).toBeInstanceOf(Date);
    expect(hit[0].week?.[0].status?.startsAt).toBeInstanceOf(Date);
    expect(hit[0].week?.[0].announcement?.endsAt).toBeInstanceOf(Date);
  });
});
