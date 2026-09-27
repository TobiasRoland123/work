import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

const auth = vi.hoisted(() => ({
  requireUserId: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND');
  }),
  limit: vi.fn(),
  where: vi.fn(),
}));

vi.mock('@/lib/auth/require-user', () => ({ requireUserId: auth.requireUserId }));
vi.mock('next/navigation', () => ({ notFound: auth.notFound }));
vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (clause: unknown) => {
          auth.where(clause);
          return { limit: auth.limit };
        },
      }),
    }),
  },
}));

import { canReviewMessages, requireMessageReviewer } from '@/lib/auth/message-review';

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('SLACK_TEAM_ID', 'T_CONFIGURED');
  auth.requireUserId.mockReset().mockResolvedValue('selected-user');
  auth.limit.mockReset().mockResolvedValue([]);
  auth.where.mockReset();
  auth.notFound.mockClear();
});

describe('message review permission', () => {
  it('rejects an unauthenticated request before querying the database', async () => {
    auth.requireUserId.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(requireMessageReviewer()).rejects.toThrow('NOT_FOUND');
    expect(auth.where).not.toHaveBeenCalled();
  });

  it('rejects an ordinary account, even in production', async () => {
    await expect(requireMessageReviewer()).rejects.toThrow('NOT_FOUND');
    expect(auth.where).toHaveBeenCalledOnce();
  });

  it('requires a current flag, active Slack mapping and the configured team', async () => {
    auth.limit.mockResolvedValueOnce([{ userId: 'selected-user' }]);
    await expect(requireMessageReviewer()).resolves.toBe('selected-user');

    const clause = auth.where.mock.calls[0][0];
    const query = new PgDialect().sqlToQuery(clause);
    expect(query.sql).toContain('"can_review_messages"');
    expect(query.sql).toContain('"slack_deactivated"');
    expect(query.sql).toContain('"slack_team_id"');
    expect(query.sql).toContain('"slack_user_id" is not null');
    expect(query.params).toContain('selected-user');
    expect(query.params).toContain('T_CONFIGURED');
    expect(query.params).toContain(true);
    expect(query.params).toContain(false);
  });

  it('fails closed without a configured Slack team', async () => {
    vi.stubEnv('SLACK_TEAM_ID', '');
    await expect(canReviewMessages('selected-user')).resolves.toBe(false);
    expect(auth.where).not.toHaveBeenCalled();
  });

  it('allows a mapped active account in the local sandbox workspace without a grant', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SLACK_TEAM_ID', 'T_LOCAL');
    auth.limit.mockResolvedValueOnce([{ userId: 'selected-user' }]);
    await expect(requireMessageReviewer()).resolves.toBe('selected-user');
    const query = new PgDialect().sqlToQuery(auth.where.mock.calls[0][0]);
    expect(query.sql).not.toContain('"can_review_messages"');
    expect(query.sql).toContain('"slack_deactivated"');
    expect(query.params).toContain('T_LOCAL');
  });

  it('still requires a grant for a production build pointed at the sandbox team', async () => {
    vi.stubEnv('SLACK_TEAM_ID', 'T_LOCAL');
    await expect(requireMessageReviewer()).rejects.toThrow('NOT_FOUND');
    const query = new PgDialect().sqlToQuery(auth.where.mock.calls[0][0]);
    expect(query.sql).toContain('"can_review_messages"');
  });

  it('does not allow a development build against a real team to skip the grant', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    await expect(requireMessageReviewer()).rejects.toThrow('NOT_FOUND');
    const query = new PgDialect().sqlToQuery(auth.where.mock.calls[0][0]);
    expect(query.sql).toContain('"can_review_messages"');
  });
});
