import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PgDialect } from 'drizzle-orm/pg-core';

const auth = vi.hoisted(() => ({ requireUserId: vi.fn(), limit: vi.fn(), where: vi.fn() }));
vi.mock('@/lib/auth/require-user', () => ({ requireUserId: auth.requireUserId }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));
vi.mock('@/db', () => ({
  db: { select: () => ({ from: () => ({ where: auth.where }) }) },
}));
import { canReviewMessages, requireMessageReviewer } from '@/lib/auth/message-review';

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('SLACK_TEAM_ID', 'T_CONFIGURED');
  auth.requireUserId.mockReset().mockResolvedValue('selected-user');
  auth.limit.mockReset().mockResolvedValue([]);
  auth.where.mockReset().mockReturnValue({ limit: auth.limit });
});

afterEach(() => vi.unstubAllEnvs());

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

  it('reads the role only for the requested active mapped workspace member', async () => {
    auth.limit.mockResolvedValueOnce([{ role: 'ADMIN' }]);
    await expect(canReviewMessages('requested-user')).resolves.toBe(true);
    const query = new PgDialect().sqlToQuery(auth.where.mock.calls[0][0]);
    expect(query.params).toEqual(['requested-user', 'T_CONFIGURED', false, '']);
    expect(query.sql).toContain('"slack_user_id" is not null');
    expect(query.sql).toContain('"slack_user_id" <>');
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
