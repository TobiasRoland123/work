import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ requireUserId: vi.fn(), limit: vi.fn() }));
vi.mock('@/lib/auth/require-user', () => ({ requireUserId: auth.requireUserId }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));
vi.mock('@/db', () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ limit: auth.limit }) }) }) },
}));
import { canReviewMessages, requireMessageReviewer } from '@/lib/auth/message-review';

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('SLACK_TEAM_ID', 'T_CONFIGURED');
  auth.requireUserId.mockReset().mockResolvedValue('selected-user');
  auth.limit.mockReset().mockResolvedValue([]);
});

describe('administrative message review and AI costs', () => {
  it.each(['production', 'development'])('allows only admins in %s', async (environment) => {
    vi.stubEnv('NODE_ENV', environment);
    vi.stubEnv('SLACK_TEAM_ID', environment === 'development' ? 'T_LOCAL' : 'T_CONFIGURED');
    auth.limit.mockResolvedValueOnce([{ role: 'ADMIN' }]);
    await expect(requireMessageReviewer()).resolves.toBe('selected-user');
    for (const role of ['MANAGER', 'EMPLOYEE']) {
      auth.limit.mockResolvedValueOnce([{ role }]);
      await expect(requireMessageReviewer()).rejects.toThrow('NOT_FOUND');
    }
  });

  it('rejects an unauthenticated request before querying', async () => {
    auth.requireUserId.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(requireMessageReviewer()).rejects.toThrow('NOT_FOUND');
    expect(auth.limit).not.toHaveBeenCalled();
  });

  it('fails closed without an active workspace member or configured team', async () => {
    await expect(canReviewMessages('selected-user')).resolves.toBe(false);
    vi.stubEnv('SLACK_TEAM_ID', '');
    await expect(canReviewMessages('selected-user')).resolves.toBe(false);
    expect(auth.limit).toHaveBeenCalledOnce();
  });
});
