import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  requirePageUserId: vi.fn(),
  requireMessageReviewer: vi.fn(),
  getMessageQualityDashboard: vi.fn(),
}));

vi.mock('@/lib/auth/require-user', () => ({ requirePageUserId: mocked.requirePageUserId }));
vi.mock('@/lib/auth/message-review', () => ({
  requireMessageReviewer: mocked.requireMessageReviewer,
}));
vi.mock('@/lib/message-quality/service', () => ({
  getMessageQualityDashboard: mocked.getMessageQualityDashboard,
}));
vi.mock('@/components/layout/PageHeader', () => ({ PageHeader: () => null }));
vi.mock('@/app/(authenticated)/message-quality/message-quality.css', () => ({}));

import MessageQualityPage from '@/app/(authenticated)/message-quality/page';

beforeEach(() => {
  mocked.requirePageUserId.mockReset().mockResolvedValue('selected-user');
  mocked.requireMessageReviewer.mockReset().mockResolvedValue('selected-user');
  mocked.getMessageQualityDashboard.mockReset().mockResolvedValue({
    selectedWeek: '2026-09-21',
    weeks: [],
    selectedSummary: {
      total: 0,
      converted: 0,
      unconverted: 0,
      pending: 0,
      unknown: 0,
      percentage: null,
      aiCost: { costUsd: null, calls: 0, unpricedCalls: 0 },
    },
    dailyCosts: [],
    messages: [],
    reasons: [],
    reason: '',
    page: 1,
    pageSize: 25,
    totalMessages: 0,
    totalPages: 1,
  });
});

describe('message quality page authorization', () => {
  it('does not fetch review records if the session is missing', async () => {
    mocked.requirePageUserId.mockRejectedValueOnce(new Error('LOGIN'));
    await expect(MessageQualityPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'LOGIN'
    );
    expect(mocked.requireMessageReviewer).not.toHaveBeenCalled();
    expect(mocked.getMessageQualityDashboard).not.toHaveBeenCalled();
  });

  it('does not fetch review records if the live permission is denied', async () => {
    mocked.requireMessageReviewer.mockRejectedValueOnce(new Error('NOT_FOUND'));
    await expect(MessageQualityPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'NOT_FOUND'
    );
    expect(mocked.getMessageQualityDashboard).not.toHaveBeenCalled();
  });

  it('fetches filtered records after both checks pass', async () => {
    await MessageQualityPage({
      searchParams: Promise.resolve({ week: '2026-09-21', reason: 'unclear', page: '2' }),
    });
    expect(mocked.getMessageQualityDashboard).toHaveBeenCalledWith({
      week: '2026-09-21',
      reason: 'unclear',
      page: '2',
    });
  });
});
