import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  requireUserId: vi.fn(),
  getWeekOverview: vi.fn(),
}));

vi.mock('@/lib/auth/require-user', () => ({ requireUserId: mocked.requireUserId }));
vi.mock('@/lib/services/weekOverviewQuery', () => ({ getWeekOverview: mocked.getWeekOverview }));

import { getWeekOverviewAction } from '@/app/actions/userActions';

describe('week overview refresh action', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T10:00:00Z'));
    mocked.requireUserId.mockReset().mockResolvedValue('viewer');
    mocked.getWeekOverview.mockReset().mockResolvedValue([]);
  });
  afterEach(() => vi.useRealTimers());

  it('loads only Copenhagen today when refreshing without a week', async () => {
    await getWeekOverviewAction();

    expect(mocked.getWeekOverview).toHaveBeenCalledWith(['2026-09-26']);
  });

  it('refreshes the Copenhagen date across midnight and a new work week', async () => {
    vi.setSystemTime(new Date('2026-09-27T21:59:00Z'));
    await getWeekOverviewAction();
    expect(mocked.getWeekOverview).toHaveBeenLastCalledWith(['2026-09-27']);

    vi.setSystemTime(new Date('2026-09-27T22:01:00Z'));
    await getWeekOverviewAction();
    expect(mocked.getWeekOverview).toHaveBeenLastCalledWith(['2026-09-28']);
  });

  it('keeps the explicit five-day week when refreshing a requested week', async () => {
    await getWeekOverviewAction('2026-09-21');

    expect(mocked.getWeekOverview).toHaveBeenCalledWith([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
    ]);
  });

  it('refreshes the requested single day without returning to today, including across midnight', async () => {
    vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
    await getWeekOverviewAction(undefined, '2026-10-13');
    expect(mocked.getWeekOverview).toHaveBeenLastCalledWith(['2026-10-13']);

    vi.setSystemTime(new Date('2026-10-14T22:01:00Z'));
    await getWeekOverviewAction(undefined, '2026-10-13');
    expect(mocked.getWeekOverview).toHaveBeenLastCalledWith(['2026-10-13']);
  });

  it('authenticates every refresh before reading shared cached data', async () => {
    mocked.requireUserId.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(getWeekOverviewAction()).rejects.toThrow('Unauthorized');
    expect(mocked.getWeekOverview).not.toHaveBeenCalled();
  });

  it('validates a requested day before loading attendance', async () => {
    await getWeekOverviewAction(undefined, '2026-02-31');

    expect(mocked.getWeekOverview).toHaveBeenCalledWith(['2026-09-26']);
  });
});
