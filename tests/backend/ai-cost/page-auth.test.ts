import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyAiUsage } from '@/lib/ai-cost/stats';

const mocked = vi.hoisted(() => ({
  requirePageUserId: vi.fn(),
  requireMessageReviewer: vi.fn(),
  getAiCostDashboard: vi.fn(),
}));

vi.mock('@/lib/auth/require-user', () => ({ requirePageUserId: mocked.requirePageUserId }));
vi.mock('@/lib/auth/message-review', () => ({
  requireMessageReviewer: mocked.requireMessageReviewer,
}));
vi.mock('@/lib/ai-cost/service', () => ({ getAiCostDashboard: mocked.getAiCostDashboard }));
vi.mock('@/components/layout/PageHeader', () => ({ PageHeader: () => null }));
vi.mock('@/app/(authenticated)/ai-cost/ai-cost.css', () => ({}));

import AiCostPage from '@/app/(authenticated)/ai-cost/page';

beforeEach(() => {
  mocked.requirePageUserId.mockReset().mockResolvedValue('selected-user');
  mocked.requireMessageReviewer.mockReset().mockResolvedValue('selected-user');
  mocked.getAiCostDashboard.mockReset().mockResolvedValue({
    days: 30,
    startDate: '2026-09-17',
    endDate: '2026-10-16',
    totals: emptyAiUsage(),
    daily: [],
    models: [],
    currentMonth: { start: '2026-10-01', ...emptyAiUsage() },
    previousMonth: { start: '2026-09-01', ...emptyAiUsage() },
  });
});

describe('AI cost page authorization', () => {
  it('does not fetch usage if the session is missing', async () => {
    mocked.requirePageUserId.mockRejectedValueOnce(new Error('LOGIN'));
    await expect(AiCostPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('LOGIN');
    expect(mocked.requireMessageReviewer).not.toHaveBeenCalled();
    expect(mocked.getAiCostDashboard).not.toHaveBeenCalled();
  });

  it('does not fetch usage if the live permission is denied', async () => {
    mocked.requireMessageReviewer.mockRejectedValueOnce(new Error('NOT_FOUND'));
    await expect(AiCostPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('NOT_FOUND');
    expect(mocked.getAiCostDashboard).not.toHaveBeenCalled();
  });

  it('fetches the requested period after both checks pass', async () => {
    await AiCostPage({ searchParams: Promise.resolve({ days: '7' }) });
    expect(mocked.getAiCostDashboard).toHaveBeenCalledWith({ days: '7' });
  });
});
