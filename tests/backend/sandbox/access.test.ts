import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

const access = vi.hoisted(() => ({ userId: vi.fn(), where: vi.fn(), limit: vi.fn() }));
vi.mock('@/lib/auth/require-user', () => ({ requireUserId: access.userId }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));
vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (clause: unknown) => {
          access.where(clause);
          return { limit: access.limit };
        },
      }),
    }),
  },
}));
import { canUseSandbox, requireSandboxAccess } from '@/lib/auth/sandbox';

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('SLACK_TEAM_ID', 'T_REAL');
  access.userId.mockReset().mockResolvedValue('operator');
  access.where.mockReset();
  access.limit.mockReset().mockResolvedValue([]);
});
afterEach(() => vi.unstubAllEnvs());

describe('sandbox account access', () => {
  it('rejects unauthenticated requests before reading sandbox data', async () => {
    access.userId.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(requireSandboxAccess()).rejects.toThrow('NOT_FOUND');
    expect(access.where).not.toHaveBeenCalled();
  });
  it('requires a grant, active Slack identity and configured workspace rather than a role', async () => {
    access.limit.mockResolvedValueOnce([{ userId: 'operator' }]);
    await expect(requireSandboxAccess()).resolves.toBeUndefined();
    const query = new PgDialect().sqlToQuery(access.where.mock.calls[0][0]);
    expect(query.sql).toContain('"can_use_sandbox"');
    expect(query.sql).toContain('"slack_deactivated"');
    expect(query.sql).toContain('"slack_team_id"');
    expect(query.sql).toContain('"slack_user_id" is not null');
    expect(query.sql).not.toContain('system_role');
    expect(query.params).toEqual(['operator', true, 'T_REAL', false, '']);
  });
  it('denies ordinary and revoked accounts in production', async () => {
    await expect(requireSandboxAccess()).rejects.toThrow('NOT_FOUND');
  });
  it('fails closed without a configured Slack workspace', async () => {
    vi.stubEnv('SLACK_TEAM_ID', '');
    await expect(canUseSandbox('operator')).resolves.toBe(false);
    expect(access.where).not.toHaveBeenCalled();
  });
  it('preserves anonymous local sandbox access', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SLACK_TEAM_ID', 'T_LOCAL');
    await expect(requireSandboxAccess()).resolves.toBeUndefined();
    expect(access.userId).not.toHaveBeenCalled();
  });
  it.each(['production', 'development'])(
    'requires a grant in a real workspace under %s',
    async (env) => {
      vi.stubEnv('NODE_ENV', env);
      await expect(requireSandboxAccess()).rejects.toThrow('NOT_FOUND');
    }
  );
  it('does not bypass permission in production pointed at T_LOCAL', async () => {
    vi.stubEnv('SLACK_TEAM_ID', 'T_LOCAL');
    await expect(requireSandboxAccess()).rejects.toThrow('NOT_FOUND');
  });
});
