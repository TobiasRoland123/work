import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { Status } from '@/db/types';

const mocks = vi.hoisted(() => ({
  requireUserId: vi.fn(),
  getUserRole: vi.fn(),
  select: vi.fn(),
  data: [] as unknown[][],
  queries: [] as { selection: unknown; predicate?: unknown }[],
}));
vi.mock('@/lib/auth/require-user', () => ({ requireUserId: mocks.requireUserId }));
vi.mock('@/lib/auth/roles', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/roles')>()),
  getUserRole: mocks.getUserRole,
}));
vi.mock('@/db', () => ({ db: { select: mocks.select } }));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));

import { attendanceWindowCondition, getPersonalStats } from '@/lib/personal-stats/service';
import { status, users } from '@/db/schema';

const dialect = new PgDialect();
const sqlFor = (predicate: unknown) => dialect.sqlToQuery(predicate as SQL);
const now = new Date('2026-09-25T10:00:00Z');
const subject = { userId: 'signed-in-user', createdAt: '2026-01-01 00:00:00' };
const colleague = (index: number) => ({
  userId: `colleague-${index}`,
  createdAt: '2026-01-01 00:00:00',
});
const row = (userID: string, id: number): Status => ({
  id,
  userID,
  status: 'IN_OFFICE',
  fromDate: '2026-09-21',
  toDate: '2026-09-25',
  details: null,
  emoji: null,
  startsAt: null,
  endsAt: null,
  startsAtApproximate: false,
  endsAtApproximate: false,
  sourceMessageKey: null,
  createdAt: '2026-09-20 12:00:00',
  announcedAt: new Date('2026-09-20T10:00:00Z'),
  time: null,
});

beforeEach(() => {
  vi.stubEnv('SLACK_TEAM_ID', 'configured-workspace');
  mocks.requireUserId.mockReset().mockResolvedValue(subject.userId);
  mocks.getUserRole.mockReset().mockResolvedValue('EMPLOYEE');
  mocks.queries.length = 0;
  mocks.data.length = 0;
  mocks.select.mockReset().mockImplementation((selection) => {
    const query = { selection, predicate: undefined as unknown };
    mocks.queries.push(query);
    const rows = mocks.data.shift() ?? [];
    const builder = {
      from: vi.fn(() => builder),
      where: vi.fn((predicate) => {
        query.predicate = predicate;
        return builder;
      }),
      groupBy: vi.fn(() => builder),
      then: (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(rows).then(resolve, reject),
    };
    return builder;
  });
});

describe('personal stats self access', () => {
  it('rejects unauthenticated requests before reading a role or attendance', async () => {
    mocks.requireUserId.mockRejectedValue(new Error('Unauthorized'));
    await expect(getPersonalStats()).rejects.toThrow('NOT_FOUND');
    expect(mocks.getUserRole).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it('rejects an unmapped or deactivated account before loading attendance', async () => {
    mocks.getUserRole.mockResolvedValue(null);
    await expect(getPersonalStats()).rejects.toThrow('REDIRECT:/permission-denied');
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it.each(['EMPLOYEE', 'MANAGER', 'ADMIN'])(
    'allows an active mapped %s to read only their own attendance',
    async (role) => {
      mocks.getUserRole.mockResolvedValue(role);
      mocks.data.push([subject], [], [row(subject.userId, 1)]);
      const result = await getPersonalStats({ days: '7', compare: 'off' }, now);
      expect(mocks.getUserRole).toHaveBeenCalledExactlyOnceWith(subject.userId);
      expect(result).toMatchObject({
        range: 7,
        comparison: false,
        totals: { office: 5, recorded: 5 },
        company: { officeShare: null, comparisonReason: 'off' },
      });
    }
  );

  it('does not accept a requested target user and keeps every off-mode query self-only', async () => {
    mocks.data.push([subject], [], [row(subject.userId, 1)]);
    await getPersonalStats(
      { days: '7', compare: 'off', userId: 'another-user' } as { days: string; compare: string },
      now
    );
    const member = sqlFor(mocks.queries[0]?.predicate);
    expect(member.sql).toContain('"users"."user_id" =');
    expect(member.params).toContain(subject.userId);
    expect(member.params).not.toContain('another-user');
    for (const query of mocks.queries.slice(1)) {
      const compiled = sqlFor(query.predicate);
      expect(compiled.params).toContain(subject.userId);
      expect(compiled.params).not.toContain('another-user');
    }
    expect(mocks.queries).toHaveLength(3);
  });

  it('requires configured workspace membership in the member query', async () => {
    mocks.data.push([subject], [], []);
    await getPersonalStats({ compare: 'off' }, now);
    expect(mocks.queries[0]?.selection).toEqual({
      userId: users.userId,
      createdAt: users.createdAt,
    });
    const compiled = sqlFor(mocks.queries[0]?.predicate);
    expect(compiled.sql).toContain('"users"."slack_team_id" =');
    expect(compiled.sql).toContain('"users"."slack_deactivated" =');
    expect(compiled.sql).toContain('"users"."slack_user_id" is not null');
    expect(compiled.sql).toContain('"users"."slack_user_id" <>');
    expect(compiled.params).toContain('configured-workspace');
    expect(compiled.params).toContain(false);
    expect(compiled.params).toContain('');
  });

  it('rejects a member removed between the role read and attendance read', async () => {
    mocks.data.push([]);
    await expect(getPersonalStats({}, now)).rejects.toThrow('REDIRECT:/permission-denied');
    expect(mocks.queries).toHaveLength(1);
  });

  it('refuses missing workspace configuration', async () => {
    vi.stubEnv('SLACK_TEAM_ID', '');
    await expect(getPersonalStats({}, now)).rejects.toThrow('REDIRECT:/permission-denied');
    expect(mocks.select).not.toHaveBeenCalled();
  });
});

describe('personal stats aggregate and query bounds', () => {
  it('defaults comparison on, excludes self from the aggregate and returns no colleague identifiers or absence breakdown', async () => {
    const others = Array.from({ length: 4 }, (_, index) => colleague(index));
    mocks.data.push(
      [subject, ...others],
      [],
      [
        { ...row(subject.userId, 1), status: 'FROM_HOME' },
        ...others.map((other, index) => row(other.userId, index + 2)),
      ]
    );
    const result = await getPersonalStats({ days: '7' }, now);
    expect(result.comparison).toBe(true);
    expect(result.totals.officeShare).toBe(0);
    expect(result.company).toEqual({ officeShare: 1, comparisonReason: null });
    expect(Object.keys(result.company)).toEqual(['officeShare', 'comparisonReason']);
    const serialized = JSON.stringify(result);
    for (const member of [subject, ...others]) expect(serialized).not.toContain(member.userId);
    expect(serialized).not.toContain('sick');
    expect(serialized).not.toContain('vacation');
    expect(sqlFor(mocks.queries[0]?.predicate).sql).not.toContain('"users"."user_id" =');
  });

  it('reads the earliest visible real declaration and overlaps the selected window', async () => {
    mocks.data.push([subject], [], []);
    await getPersonalStats({ days: '7', compare: 'off' }, now);
    const first = sqlFor(mocks.queries[1]?.predicate);
    expect(first.sql).toContain('"status"."id" >');
    expect(first.sql).toContain('"status"."status" is not null');
    expect(first.sql).toContain('not exists');
    expect(first.params).toContain(0);
    const selection = mocks.queries[1]?.selection as { userId: unknown; firstDay: SQL };
    expect(selection.userId).toBe(status.userID);
    const earliest = sqlFor(selection.firstDay).sql;
    expect(earliest).toContain('least(min(');
    expect(earliest).toContain('"status"."from_date"');
    expect(earliest).toContain('"status"."starts_at"');
    expect(earliest).toContain('"status"."announced_at"');
    const bounded = sqlFor(mocks.queries[2]?.predicate);
    expect(bounded.sql).toContain('not exists');
    expect(bounded.sql).toContain('"status"."to_date" >=');
    expect(bounded.sql).toContain('"status"."from_date" <=');
    expect(bounded.sql).toContain('"status"."starts_at" <=');
    expect(bounded.sql).toContain('"status"."ends_at" >=');
    expect(bounded.params).toContain('2026-09-20');
    expect(bounded.params).toContain('2026-09-26');
  });

  it('bounds clock-only and undated rows in the configured timezone', () => {
    const compiled = sqlFor(attendanceWindowCondition('2026-10-23', '2026-10-26'));
    expect(compiled.sql).toContain('"status"."from_date" is null');
    expect(compiled.sql).toContain('"status"."to_date" is null');
    expect(compiled.sql).toContain("at time zone 'Europe/Copenhagen'");
    expect(compiled.params).toContain('2026-10-21T22:00:00.000Z');
    expect(compiled.params).toContain('2026-10-27T23:00:00.000Z');
  });

  it('uses an earlier declaration before join for tracking and the same trimmed weekdays for colleagues', async () => {
    const others = Array.from({ length: 4 }, (_, index) => colleague(index));
    const recent = { ...subject, createdAt: '2026-09-24 08:00:00' };
    mocks.data.push(
      [recent, ...others],
      [{ userId: subject.userId, firstDay: '2026-09-22' }],
      [row(subject.userId, 1), ...others.map((other, index) => row(other.userId, index + 2))]
    );
    const result = await getPersonalStats({ days: '7' }, now);
    expect(result).toMatchObject({
      startDate: '2026-09-22',
      workdays: 4,
      totals: { eligible: 4, office: 4 },
    });
    expect(result.series.map((point) => point.startDate)).toEqual([
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
    ]);
    expect(result.company.officeShare).toBe(1);
  });

  it('does not load a status window or count days for a future join', async () => {
    mocks.data.push([{ ...subject, createdAt: '2026-10-01 08:00:00' }], []);
    const result = await getPersonalStats({ days: '7', compare: 'off' }, now);
    expect(result).toMatchObject({
      workdays: 0,
      totals: { eligible: 0, coverage: null, officeShare: null },
      series: [],
    });
    expect(mocks.queries).toHaveLength(2);
  });
});
