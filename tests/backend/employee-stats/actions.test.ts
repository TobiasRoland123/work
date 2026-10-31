import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

const mocked = vi.hoisted(() => ({
  requireEmployeeStatsAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  selectLimit: vi.fn(),
  selectWhere: vi.fn(),
  insertValues: vi.fn(),
  onConflictDoNothing: vi.fn(),
  deleteWhere: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: mocked.revalidatePath }));
vi.mock('next/navigation', () => ({ notFound: vi.fn() }));
vi.mock('@/lib/auth/require-user', () => ({ requireUserId: vi.fn() }));
vi.mock('@/lib/auth/employee-stats', async () => ({
  ...(await vi.importActual<typeof import('@/lib/auth/employee-stats')>(
    '@/lib/auth/employee-stats'
  )),
  requireEmployeeStatsAdmin: mocked.requireEmployeeStatsAdmin,
}));
vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (clause: unknown) => {
          mocked.selectWhere(clause);
          return { limit: mocked.selectLimit };
        },
      }),
    }),
    insert: () => ({
      values: (values: unknown) => {
        mocked.insertValues(values);
        return { onConflictDoNothing: mocked.onConflictDoNothing };
      },
    }),
    delete: () => ({ where: mocked.deleteWhere }),
  },
}));

import {
  grantEmployeeStatsAccessAction,
  revokeEmployeeStatsAccessAction,
} from '@/app/actions/employeeStatsActions';

beforeEach(() => {
  vi.stubEnv('SLACK_TEAM_ID', 'T02HKL21R');
  mocked.requireEmployeeStatsAdmin.mockReset().mockResolvedValue('admin-user');
  mocked.revalidatePath.mockReset();
  mocked.selectLimit.mockReset().mockResolvedValue([{ userId: 'colleague' }]);
  mocked.selectWhere.mockReset();
  mocked.insertValues.mockReset();
  mocked.onConflictDoNothing.mockReset().mockResolvedValue(undefined);
  mocked.deleteWhere.mockReset().mockResolvedValue(undefined);
});

describe('granting employee stats access', () => {
  it('stops before touching the database when the caller is not the admin', async () => {
    mocked.requireEmployeeStatsAdmin.mockRejectedValueOnce(new Error('NOT_FOUND'));
    await expect(grantEmployeeStatsAccessAction({ userId: 'colleague' })).rejects.toThrow(
      'NOT_FOUND'
    );
    expect(mocked.selectWhere).not.toHaveBeenCalled();
    expect(mocked.insertValues).not.toHaveBeenCalled();
    expect(mocked.revalidatePath).not.toHaveBeenCalled();
  });

  it('records the grant with the admin who gave it and refreshes both pages', async () => {
    await expect(grantEmployeeStatsAccessAction({ userId: 'colleague' })).resolves.toEqual({
      ok: true,
    });
    expect(mocked.insertValues).toHaveBeenCalledWith({
      userId: 'colleague',
      grantedByUserId: 'admin-user',
    });
    expect(mocked.onConflictDoNothing).toHaveBeenCalledOnce();
    expect(mocked.revalidatePath).toHaveBeenCalledWith('/employee-stats');
    expect(mocked.revalidatePath).toHaveBeenCalledWith('/employee-stats/access');
  });

  it('only grants to active members of the configured workspace', async () => {
    await grantEmployeeStatsAccessAction({ userId: 'colleague' });
    const query = new PgDialect().sqlToQuery(mocked.selectWhere.mock.calls[0][0]);
    expect(query.sql).toContain('"slack_deactivated"');
    expect(query.sql).toContain('"slack_team_id"');
    expect(query.params).toEqual(expect.arrayContaining(['colleague', 'T02HKL21R', false]));
  });

  it('refuses a person who is unknown or deactivated', async () => {
    mocked.selectLimit.mockResolvedValueOnce([]);
    await expect(grantEmployeeStatsAccessAction({ userId: 'gone' })).resolves.toEqual({
      ok: false,
      error: 'That person is not an active member of the workspace.',
    });
    expect(mocked.insertValues).not.toHaveBeenCalled();
    expect(mocked.revalidatePath).not.toHaveBeenCalled();
  });

  it('does not store a grant for the admin themself', async () => {
    await expect(grantEmployeeStatsAccessAction({ userId: 'admin-user' })).resolves.toEqual({
      ok: false,
      error: 'The admin always has access.',
    });
    expect(mocked.insertValues).not.toHaveBeenCalled();
  });

  it('rejects malformed input without a database call', async () => {
    for (const userId of ['', 'x'.repeat(37), undefined, 42, null]) {
      await expect(
        grantEmployeeStatsAccessAction({ userId } as unknown as { userId: string })
      ).resolves.toMatchObject({ ok: false });
    }
    await expect(
      grantEmployeeStatsAccessAction(undefined as unknown as { userId: string })
    ).resolves.toMatchObject({ ok: false });
    expect(mocked.selectWhere).not.toHaveBeenCalled();
    expect(mocked.insertValues).not.toHaveBeenCalled();
  });
});

describe('revoking employee stats access', () => {
  it('stops before touching the database when the caller is not the admin', async () => {
    mocked.requireEmployeeStatsAdmin.mockRejectedValueOnce(new Error('NOT_FOUND'));
    await expect(revokeEmployeeStatsAccessAction({ userId: 'colleague' })).rejects.toThrow(
      'NOT_FOUND'
    );
    expect(mocked.deleteWhere).not.toHaveBeenCalled();
    expect(mocked.revalidatePath).not.toHaveBeenCalled();
  });

  it('deletes only the chosen person’s grant and refreshes both pages', async () => {
    await expect(revokeEmployeeStatsAccessAction({ userId: 'colleague' })).resolves.toEqual({
      ok: true,
    });
    const query = new PgDialect().sqlToQuery(mocked.deleteWhere.mock.calls[0][0]);
    expect(query.sql).toContain('"employee_stats_access"."user_id" = $1');
    expect(query.params).toEqual(['colleague']);
    expect(mocked.revalidatePath).toHaveBeenCalledWith('/employee-stats');
    expect(mocked.revalidatePath).toHaveBeenCalledWith('/employee-stats/access');
  });

  it('rejects malformed input without a database call', async () => {
    await expect(revokeEmployeeStatsAccessAction({ userId: '' })).resolves.toMatchObject({
      ok: false,
    });
    expect(mocked.deleteWhere).not.toHaveBeenCalled();
  });
});
