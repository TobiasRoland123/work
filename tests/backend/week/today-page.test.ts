import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

const mocked = vi.hoisted(() => ({
  requirePageUserId: vi.fn(),
  getWeekOverview: vi.fn(),
  getUpcoming: vi.fn(),
  listPinnedIds: vi.fn(),
  cookies: vi.fn(),
}));

vi.mock('@/lib/auth/require-user', () => ({ requirePageUserId: mocked.requirePageUserId }));
vi.mock('@/lib/services/weekOverviewQuery', () => ({ getWeekOverview: mocked.getWeekOverview }));
vi.mock('@/lib/services/statusService', () => ({
  statusService: { getUpcomingStatusesByUserUserId: mocked.getUpcoming },
}));
vi.mock('@/lib/services/pinService', () => ({
  pinService: { listPinnedIds: mocked.listPinnedIds },
}));
vi.mock('next/headers', () => ({ cookies: mocked.cookies }));
vi.mock('@/app/(authenticated)/today/WeekOverviewWrapper', () => ({
  WeekOverviewWrapper: () => null,
}));

import WeekPage from '@/app/(authenticated)/today/page';

describe('/today page days', () => {
  beforeEach(() => {
    vi.stubGlobal('React', React);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T10:00:00Z'));
    mocked.requirePageUserId.mockReset().mockResolvedValue('viewer');
    mocked.getWeekOverview.mockReset().mockResolvedValue([]);
    mocked.getUpcoming.mockReset().mockResolvedValue([]);
    mocked.listPinnedIds.mockReset().mockResolvedValue([]);
    mocked.cookies.mockReset().mockResolvedValue({ get: () => undefined });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each(['2026-09-26T10:00:00Z', '2026-09-25T22:30:00Z'])(
    'passes only Copenhagen today for the default route at %s, including a weekend',
    async (now) => {
      vi.setSystemTime(new Date(now));
      const element = await WeekPage({ searchParams: Promise.resolve({}) });

      expect(mocked.getWeekOverview).toHaveBeenCalledWith(['2026-09-26']);
      expect(element.props).toEqual(
        expect.objectContaining({ days: ['2026-09-26'], today: '2026-09-26' })
      );
    }
  );

  it('keeps five days for an explicit week query', async () => {
    await WeekPage({ searchParams: Promise.resolve({ week: '2026-09-21' }) });

    expect(mocked.getWeekOverview).toHaveBeenCalledWith([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
    ]);
  });

  it.each(['2026-10-13', '2026-10-18', '2026-12-31', '2027-01-01'])(
    'loads and retains the requested single day %s on page reload',
    async (day) => {
      vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
      const props = { searchParams: Promise.resolve({ day }) };

      const first = await WeekPage(props);
      const reloaded = await WeekPage(props);

      expect(mocked.getWeekOverview).toHaveBeenCalledWith([day]);
      expect(first.props).toEqual(
        expect.objectContaining({ days: [day], day, today: '2026-10-14' })
      );
      expect(first.key).toBe(day);
      expect(reloaded.props).toEqual(first.props);
      expect(reloaded.key).toBe(day);
    }
  );

  it.each(['2026-02-31', 'not-a-date', ['2026-10-13', '2026-10-14']])(
    'falls back to Copenhagen today for invalid day input %s',
    async (day) => {
      const element = await WeekPage({ searchParams: Promise.resolve({ day }) });

      expect(mocked.getWeekOverview).toHaveBeenCalledWith(['2026-09-26']);
      expect(element.props.days).toEqual(['2026-09-26']);
    }
  );

  it('loads the signed-in person’s pinned colleagues for the board', async () => {
    mocked.listPinnedIds.mockResolvedValue(['marie', 'peter']);

    const element = await WeekPage({ searchParams: Promise.resolve({}) });

    expect(mocked.listPinnedIds).toHaveBeenCalledWith('viewer');
    expect(element.props.initialPinnedIds).toEqual(['marie', 'peter']);
  });

  it('opens the side panel unless the visitor closed it', async () => {
    const open = await WeekPage({ searchParams: Promise.resolve({}) });
    expect(open.props.initialPanelOpen).toBe(true);

    mocked.cookies.mockResolvedValue({
      get: (name: string) => (name === 'week-panel' ? { value: 'closed' } : undefined),
    });
    const closed = await WeekPage({ searchParams: Promise.resolve({}) });
    expect(closed.props.initialPanelOpen).toBe(false);
  });

  it('keeps week mode when both query parameters are present', async () => {
    const element = await WeekPage({
      searchParams: Promise.resolve({ week: '2026-09-21', day: '2026-10-13' }),
    });

    expect(element.props.days).toEqual([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
    ]);
    expect(element.props.day).toBeUndefined();
  });

  it('remounts between live today, explicit today, and a different day in the same week', async () => {
    const live = await WeekPage({ searchParams: Promise.resolve({}) });
    const explicit = await WeekPage({ searchParams: Promise.resolve({ day: '2026-09-26' }) });
    const previous = await WeekPage({ searchParams: Promise.resolve({ day: '2026-09-25' }) });

    expect(new Set([live.key, explicit.key, previous.key]).size).toBe(3);
    expect(live.props.day).toBeUndefined();
  });

  it('remounts when switching between a single Monday and its full week', async () => {
    const single = await WeekPage({ searchParams: Promise.resolve({ day: '2026-10-12' }) });
    const week = await WeekPage({ searchParams: Promise.resolve({ week: '2026-10-12' }) });

    expect(single.key).not.toBe(week.key);
    expect(single.props.days).toHaveLength(1);
    expect(week.props.days).toHaveLength(5);
  });
});
