import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  requireUserId: vi.fn(),
  getAllUsers: vi.fn(),
}));

vi.mock('@/lib/auth/require-user', () => ({ requireUserId: mocked.requireUserId }));
vi.mock('@/lib/services/userService', () => ({ userService: { getAllUsers: mocked.getAllUsers } }));

import { getWeekOverviewAction } from '@/app/actions/userActions';

describe('week overview refresh action', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T10:00:00Z'));
    mocked.requireUserId.mockReset().mockResolvedValue('viewer');
    mocked.getAllUsers.mockReset().mockResolvedValue([]);
  });
  afterEach(() => vi.useRealTimers());

  it('loads only Copenhagen today when refreshing without a week', async () => {
    await getWeekOverviewAction();

    expect(mocked.getAllUsers).toHaveBeenCalledWith(false, ['2026-09-26']);
  });

  it('refreshes the Copenhagen date across midnight and a new work week', async () => {
    vi.setSystemTime(new Date('2026-09-27T21:59:00Z'));
    await getWeekOverviewAction();
    expect(mocked.getAllUsers).toHaveBeenLastCalledWith(false, ['2026-09-27']);

    vi.setSystemTime(new Date('2026-09-27T22:01:00Z'));
    await getWeekOverviewAction();
    expect(mocked.getAllUsers).toHaveBeenLastCalledWith(false, ['2026-09-28']);
  });

  it('keeps the explicit five-day week when refreshing a requested week', async () => {
    await getWeekOverviewAction('2026-09-21');

    expect(mocked.getAllUsers).toHaveBeenCalledWith(false, [
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
    ]);
  });
});
