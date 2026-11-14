import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getPersonalStats: vi.fn() }));
vi.mock('@/lib/personal-stats/service', () => ({ getPersonalStats: mocks.getPersonalStats }));
vi.mock('@/components/personal-stats/PersonalStatsDashboard', () => ({
  PersonalStatsDashboard: () => null,
}));

import MyStatsPage from '@/app/(authenticated)/my-stats/page';

beforeEach(() => {
  mocks.getPersonalStats.mockReset().mockResolvedValue({});
});

describe('personal dashboard route', () => {
  it('passes only period and comparison preferences to the authenticated service', async () => {
    await MyStatsPage({
      searchParams: Promise.resolve({ range: '90', comparison: 'off', userId: 'someone-else' }),
    });
    expect(mocks.getPersonalStats).toHaveBeenCalledExactlyOnceWith({ days: '90', compare: 'off' });
  });

  it('ignores repeated parameters so the service applies its defaults', async () => {
    await MyStatsPage({
      searchParams: Promise.resolve({ range: ['7', '365'], comparison: ['off', 'on'] }),
    });
    expect(mocks.getPersonalStats).toHaveBeenCalledExactlyOnceWith({
      days: undefined,
      compare: undefined,
    });
  });

  it('does not render a dashboard when the service denies access', async () => {
    mocks.getPersonalStats.mockRejectedValue(new Error('REDIRECT:/permission-denied'));
    await expect(MyStatsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'REDIRECT:/permission-denied'
    );
  });
});
