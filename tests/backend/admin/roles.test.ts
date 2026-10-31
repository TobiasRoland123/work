import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

const mocked = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  transaction: vi.fn(),
  execute: vi.fn(),
  actorWhere: vi.fn(),
  actorLimit: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
  returning: vi.fn(),
  listWhere: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: mocked.revalidatePath }));
vi.mock('@/lib/auth/roles', async () => {
  const { and, eq, isNotNull, ne } = await import('drizzle-orm');
  const { users } = await import('@/db/schema');
  return {
    requireAdmin: mocked.requireAdmin,
    activeWorkspaceMember: (teamId: string) =>
      and(
        eq(users.slackTeamId, teamId),
        eq(users.slackDeactivated, false),
        isNotNull(users.slackUserId),
        ne(users.slackUserId, '')
      ),
  };
});
vi.mock('@/db', () => ({
  db: {
    transaction: mocked.transaction,
    select: () => ({ from: () => ({ where: mocked.listWhere }) }),
  },
}));

import { changeUserRoleAction } from '@/app/actions/roleActions';
import { listUserRoles } from '@/lib/admin/roles';

const dialect = new PgDialect();

beforeEach(() => {
  vi.stubEnv('SLACK_TEAM_ID', 'T_CONFIGURED');
  vi.clearAllMocks();
  mocked.requireAdmin.mockReset().mockResolvedValue('admin-user');
  mocked.execute.mockResolvedValue(undefined);
  mocked.actorLimit.mockReset().mockResolvedValue([{ userId: 'admin-user' }]);
  mocked.returning.mockReset().mockResolvedValue([{ userId: 'colleague' }]);
  mocked.listWhere.mockReset().mockResolvedValue([]);
  const tx = {
    execute: mocked.execute,
    select: () => ({
      from: () => ({
        where: (clause: unknown) => {
          mocked.actorWhere(clause);
          return { limit: mocked.actorLimit };
        },
      }),
    }),
    update: () => ({
      set: (values: unknown) => {
        mocked.updateSet(values);
        return {
          where: (clause: unknown) => {
            mocked.updateWhere(clause);
            return { returning: mocked.returning };
          },
        };
      },
    }),
  };
  mocked.transaction.mockReset().mockImplementation(async (callback) => callback(tx));
});

describe('changing application roles', () => {
  it('rejects a nonadmin before touching role data', async () => {
    mocked.requireAdmin.mockRejectedValueOnce(new Error('NOT_FOUND'));
    await expect(changeUserRoleAction({ userId: 'colleague', role: 'ADMIN' })).rejects.toThrow(
      'NOT_FOUND'
    );
    expect(mocked.transaction).not.toHaveBeenCalled();
    expect(mocked.revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects invalid roles and missing people without starting a transaction', async () => {
    for (const input of [
      undefined,
      null,
      { userId: '', role: 'ADMIN' },
      { userId: 'colleague', role: 'OWNER' },
      { userId: 'colleague', role: 'USER' },
    ]) {
      await expect(changeUserRoleAction(input)).resolves.toMatchObject({ ok: false });
    }
    expect(mocked.transaction).not.toHaveBeenCalled();
  });

  it('does not let an admin change their own role', async () => {
    await expect(
      changeUserRoleAction({ userId: 'admin-user', role: 'EMPLOYEE' })
    ).resolves.toMatchObject({ ok: false, error: 'Ask another admin to change your role.' });
    expect(mocked.transaction).not.toHaveBeenCalled();
  });

  it('serializes changes and checks the caller role again before updating', async () => {
    await expect(changeUserRoleAction({ userId: 'colleague', role: 'MANAGER' })).resolves.toEqual({
      ok: true,
    });
    const lock = dialect.sqlToQuery(mocked.execute.mock.calls[0][0]);
    expect(lock.sql).toContain('pg_advisory_xact_lock');
    expect(lock.params).toContain('application-roles:T_CONFIGURED');
    expect(mocked.execute.mock.invocationCallOrder[0]).toBeLessThan(
      mocked.actorWhere.mock.invocationCallOrder[0]
    );
    const actor = dialect.sqlToQuery(mocked.actorWhere.mock.calls[0][0]);
    expect(actor.params).toEqual(
      expect.arrayContaining(['admin-user', 'ADMIN', 'T_CONFIGURED', false])
    );
    expect(actor.sql).toContain('"slack_user_id" is not null');
    expect(mocked.updateSet).toHaveBeenCalledWith({ systemRole: 'MANAGER' });
    expect(mocked.revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('rejects a caller whose admin role was revoked while they waited', async () => {
    mocked.actorLimit.mockResolvedValueOnce([]);
    await expect(
      changeUserRoleAction({ userId: 'colleague', role: 'ADMIN' })
    ).resolves.toMatchObject({
      ok: false,
      error: 'You no longer have permission to change roles.',
    });
    expect(mocked.updateSet).not.toHaveBeenCalled();
    expect(mocked.revalidatePath).not.toHaveBeenCalled();
  });

  it('limits role changes to active mapped members of the configured workspace', async () => {
    mocked.returning.mockResolvedValueOnce([]);
    await expect(
      changeUserRoleAction({ userId: 'outsider', role: 'ADMIN' })
    ).resolves.toMatchObject({
      ok: false,
      error: 'That person is not an active member of the workspace.',
    });
    const target = dialect.sqlToQuery(mocked.updateWhere.mock.calls[0][0]);
    expect(target.params).toEqual(expect.arrayContaining(['outsider', 'T_CONFIGURED', false]));
    expect(target.sql).toContain('"slack_user_id" is not null');
    expect(mocked.revalidatePath).not.toHaveBeenCalled();
  });

  it('fails closed when the workspace is missing', async () => {
    vi.stubEnv('SLACK_TEAM_ID', '');
    await expect(
      changeUserRoleAction({ userId: 'colleague', role: 'ADMIN' })
    ).resolves.toMatchObject({ ok: false });
    expect(mocked.transaction).not.toHaveBeenCalled();
  });
});

describe('listing application roles', () => {
  it('checks admin authorization at the read boundary', async () => {
    mocked.requireAdmin.mockRejectedValueOnce(new Error('NOT_FOUND'));
    await expect(listUserRoles()).rejects.toThrow('NOT_FOUND');
    expect(mocked.listWhere).not.toHaveBeenCalled();
  });

  it('returns readable sorted names for active mapped workspace members', async () => {
    mocked.listWhere.mockResolvedValueOnce([
      { userId: 'b', firstName: null, lastName: null, email: 'z@example.com', role: 'EMPLOYEE' },
      {
        userId: 'a',
        firstName: 'Anna',
        lastName: 'Attendee',
        email: 'a@example.com',
        role: 'ADMIN',
      },
    ]);
    expect(await listUserRoles()).toEqual([
      { userId: 'a', name: 'Anna Attendee', email: 'a@example.com', role: 'ADMIN' },
      { userId: 'b', name: 'z@example.com', email: 'z@example.com', role: 'EMPLOYEE' },
    ]);
    const query = dialect.sqlToQuery(mocked.listWhere.mock.calls[0][0]);
    expect(query.params).toEqual(expect.arrayContaining(['T_CONFIGURED', false]));
    expect(query.sql).toContain('"slack_user_id" is not null');
  });
});
