import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

const auth = vi.hoisted(() => ({
  requireUserId: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND');
  }),
  limit: vi.fn(),
  where: vi.fn(),
  leftJoin: vi.fn(),
}));

vi.mock('@/lib/auth/require-user', () => ({ requireUserId: auth.requireUserId }));
vi.mock('next/navigation', () => ({ notFound: auth.notFound }));
vi.mock('@/db', () => {
  const query = {
    from: () => query,
    leftJoin: (...args: unknown[]) => {
      auth.leftJoin(...args);
      return query;
    },
    where: (clause: unknown) => {
      auth.where(clause);
      return { limit: auth.limit };
    },
  };
  return { db: { select: () => query } };
});

import {
  canViewEmployeeStats,
  isEmployeeStatsAdmin,
  requireEmployeeStatsAdmin,
  requireEmployeeStatsViewer,
} from '@/lib/auth/employee-stats';
import { ADMIN_SLACK_IDENTITY } from '@/lib/auth/admin-identity';
import { isInitialMessageReviewer } from '@/lib/auth/message-review-defaults';

const sqlOf = () => new PgDialect().sqlToQuery(auth.where.mock.calls[0][0]);

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('SLACK_TEAM_ID', ADMIN_SLACK_IDENTITY.teamId);
  auth.requireUserId.mockReset().mockResolvedValue('selected-user');
  auth.limit.mockReset().mockResolvedValue([]);
  auth.where.mockReset();
  auth.leftJoin.mockReset();
  auth.notFound.mockClear();
});

describe('admin identity', () => {
  it('is Tobias Roland’s verified Slack identity, shared with the first message reviewer', () => {
    expect(ADMIN_SLACK_IDENTITY).toEqual({ teamId: 'T02HKL21R', slackUserId: 'U05NP1NF3QB' });
    expect(isInitialMessageReviewer('T02HKL21R', 'U05NP1NF3QB')).toBe(true);
    expect(isInitialMessageReviewer('T02HKL21R', 'U_OTHER')).toBe(false);
  });
});

describe('employee stats viewer permission', () => {
  it('rejects an unauthenticated request before querying the database', async () => {
    auth.requireUserId.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(requireEmployeeStatsViewer()).rejects.toThrow('NOT_FOUND');
    expect(auth.where).not.toHaveBeenCalled();
  });

  it('rejects an ordinary account without a grant', async () => {
    await expect(requireEmployeeStatsViewer()).rejects.toThrow('NOT_FOUND');
    expect(auth.where).toHaveBeenCalledOnce();
  });

  it('allows an account with a grant or the admin Slack identity, and nobody else', async () => {
    auth.limit.mockResolvedValueOnce([{ userId: 'selected-user' }]);
    await expect(requireEmployeeStatsViewer()).resolves.toBe('selected-user');

    const query = sqlOf();
    expect(query.sql).toContain('"employee_stats_access"."user_id" is not null');
    expect(query.sql).toContain('"users"."slack_user_id" = $');
    expect(query.sql).toContain('"slack_deactivated"');
    expect(query.sql).toContain('"slack_team_id"');
    expect(query.sql).toContain('"slack_user_id" is not null');
    expect(query.params).toContain('selected-user');
    expect(query.params).toContain(ADMIN_SLACK_IDENTITY.teamId);
    expect(query.params).toContain(ADMIN_SLACK_IDENTITY.slackUserId);
    expect(auth.leftJoin).toHaveBeenCalledOnce();
  });

  it('fails closed without a configured Slack team', async () => {
    vi.stubEnv('SLACK_TEAM_ID', '');
    await expect(canViewEmployeeStats('selected-user')).resolves.toBe(false);
    expect(auth.where).not.toHaveBeenCalled();
  });

  it('has no admin shortcut in another workspace, only grants', async () => {
    vi.stubEnv('SLACK_TEAM_ID', 'T_OTHER');
    await expect(canViewEmployeeStats('selected-user')).resolves.toBe(false);
    const query = sqlOf();
    expect(query.sql).toContain('"employee_stats_access"."user_id" is not null');
    expect(query.sql).not.toContain('"users"."slack_user_id" = $');
    expect(query.params).not.toContain(ADMIN_SLACK_IDENTITY.slackUserId);
  });

  it('uses the sandbox admin only in a nonproduction build of the sandbox workspace', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SLACK_TEAM_ID', 'T_LOCAL');
    await canViewEmployeeStats('selected-user');
    expect(sqlOf().params).toContain('U_LOCAL_ANNA');
  });

  it('gives a production build pointed at the sandbox team no admin at all', async () => {
    vi.stubEnv('SLACK_TEAM_ID', 'T_LOCAL');
    await canViewEmployeeStats('selected-user');
    expect(sqlOf().params).not.toContain('U_LOCAL_ANNA');
    expect(sqlOf().params).not.toContain(ADMIN_SLACK_IDENTITY.slackUserId);
  });
});

describe('employee stats admin permission', () => {
  it('rejects an unauthenticated request before querying the database', async () => {
    auth.requireUserId.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(requireEmployeeStatsAdmin()).rejects.toThrow('NOT_FOUND');
    expect(auth.where).not.toHaveBeenCalled();
  });

  it('does not treat a viewer with a grant as an admin', async () => {
    await expect(requireEmployeeStatsAdmin()).rejects.toThrow('NOT_FOUND');
    const query = sqlOf();
    expect(query.sql).not.toContain('employee_stats_access');
    expect(query.params).toContain(ADMIN_SLACK_IDENTITY.slackUserId);
  });

  it('requires the exact admin Slack user in an active workspace account', async () => {
    auth.limit.mockResolvedValueOnce([{ userId: 'selected-user' }]);
    await expect(requireEmployeeStatsAdmin()).resolves.toBe('selected-user');
    const query = sqlOf();
    expect(query.sql).toContain('"slack_deactivated"');
    expect(query.params).toEqual(
      expect.arrayContaining([
        'selected-user',
        ADMIN_SLACK_IDENTITY.slackUserId,
        ADMIN_SLACK_IDENTITY.teamId,
        false,
      ])
    );
  });

  it('fails closed without a team or in a workspace with no admin', async () => {
    vi.stubEnv('SLACK_TEAM_ID', '');
    await expect(isEmployeeStatsAdmin('selected-user')).resolves.toBe(false);
    vi.stubEnv('SLACK_TEAM_ID', 'T_OTHER');
    await expect(isEmployeeStatsAdmin('selected-user')).resolves.toBe(false);
    expect(auth.where).not.toHaveBeenCalled();
  });

  it('makes Anna the admin of the local sandbox workspace', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SLACK_TEAM_ID', 'T_LOCAL');
    auth.limit.mockResolvedValueOnce([{ userId: 'sandbox-anna' }]);
    await expect(isEmployeeStatsAdmin('sandbox-anna')).resolves.toBe(true);
    expect(sqlOf().params).toContain('U_LOCAL_ANNA');
  });
});
