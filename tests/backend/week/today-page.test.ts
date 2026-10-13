import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

const mocked = vi.hoisted(() => ({
  requirePageUserId: vi.fn(),
  getAllUsers: vi.fn(),
  getUpcoming: vi.fn(),
}));

vi.mock('@/lib/auth/require-user', () => ({ requirePageUserId: mocked.requirePageUserId }));
vi.mock('@/lib/services/userService', () => ({ userService: { getAllUsers: mocked.getAllUsers } }));
vi.mock('@/lib/services/statusService', () => ({
  statusService: { getUpcomingStatusesByUserUserId: mocked.getUpcoming },
}));
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
    mocked.getAllUsers.mockReset().mockResolvedValue([]);
    mocked.getUpcoming.mockReset().mockResolvedValue([]);
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

      expect(mocked.getAllUsers).toHaveBeenCalledWith(false, ['2026-09-26']);
      expect(element.props).toEqual(
        expect.objectContaining({ days: ['2026-09-26'], today: '2026-09-26' })
      );
    }
  );

  it('keeps five days for an explicit week query', async () => {
    await WeekPage({ searchParams: Promise.resolve({ week: '2026-09-21' }) });

    expect(mocked.getAllUsers).toHaveBeenCalledWith(false, [
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
    ]);
  });
});
