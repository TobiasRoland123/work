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

import { getUserRole, isAdmin, requireAdmin } from '@/lib/auth/roles';
import { APP_ROLES, isAppRole } from '@/lib/auth/role-policy';

beforeEach(() => {
  vi.stubEnv('SLACK_TEAM_ID', 'T_WORKSPACE');
  auth.requireUserId.mockReset().mockResolvedValue('selected-user');
  auth.limit.mockReset().mockResolvedValue([]);
  auth.where.mockReset();
  auth.notFound.mockClear();
});

describe('workspace roles', () => {
  it.each(APP_ROLES)('reads the stored %s role, rather than session claims', async (role) => {
    auth.limit.mockResolvedValueOnce([{ role }]);
    await expect(getUserRole('selected-user')).resolves.toBe(role);
    const query = new PgDialect().sqlToQuery(auth.where.mock.calls[0][0]);
    expect(query.sql).toContain('"slack_deactivated"');
    expect(query.sql).toContain('"slack_team_id"');
    expect(query.sql).toContain('"slack_user_id" is not null');
    expect(query.params).toEqual(
      expect.arrayContaining(['selected-user', 'T_WORKSPACE', false, ''])
    );
  });

  it('fails closed for unknown roles and missing/inactive workspace accounts', async () => {
    await expect(getUserRole('selected-user')).resolves.toBeNull();
    auth.limit.mockResolvedValueOnce([{ role: 'USER' }]);
    await expect(getUserRole('selected-user')).resolves.toBeNull();
    expect(isAppRole('GUEST')).toBe(false);
    expect(isAppRole('admin')).toBe(false);
  });

  it('fails closed before querying when no workspace is configured', async () => {
    vi.stubEnv('SLACK_TEAM_ID', '');
    await expect(getUserRole('selected-user')).resolves.toBeNull();
    expect(auth.where).not.toHaveBeenCalled();
  });

  it('uses the latest role on a later request', async () => {
    auth.limit
      .mockResolvedValueOnce([{ role: 'ADMIN' }])
      .mockResolvedValueOnce([{ role: 'EMPLOYEE' }]);
    await expect(isAdmin('selected-user')).resolves.toBe(true);
    await expect(isAdmin('selected-user')).resolves.toBe(false);
  });

  it.each(['MANAGER', 'EMPLOYEE'])(
    'does not allow %s to perform admin operations',
    async (role) => {
      auth.limit.mockResolvedValueOnce([{ role }]);
      await expect(requireAdmin()).rejects.toThrow('NOT_FOUND');
    }
  );

  it('allows an active admin to perform admin operations', async () => {
    auth.limit.mockResolvedValueOnce([{ role: 'ADMIN' }]);
    await expect(requireAdmin()).resolves.toBe('selected-user');
  });

  it('rejects an unauthenticated request before querying', async () => {
    auth.requireUserId.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(requireAdmin()).rejects.toThrow('NOT_FOUND');
    expect(auth.where).not.toHaveBeenCalled();
  });
});
