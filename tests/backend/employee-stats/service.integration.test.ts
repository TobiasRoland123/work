import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db, pool } from '@/db';
import { employeeStatsAccess, status, users } from '@/db/schema';
import { requireUserId } from '@/lib/auth/require-user';
import { ADMIN_SLACK_IDENTITY } from '@/lib/auth/admin-identity';
import { canViewEmployeeStats, isEmployeeStatsAdmin } from '@/lib/auth/employee-stats';
import { listEmployeeStatsAccess } from '@/lib/employee-stats/access';
import { getEmployeeProfile, getEmployeeStats, listEmployees } from '@/lib/employee-stats/service';
import {
  grantEmployeeStatsAccessAction,
  revokeEmployeeStatsAccessAction,
} from '@/app/actions/employeeStatsActions';

vi.mock('@/lib/auth/require-user', () => ({ requireUserId: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));

const suffix = randomUUID().slice(0, 8);
const team = `TSTATS_${suffix}`;
const otherTeam = `TSTATSO_${suffix}`;
const adminTeam = ADMIN_SLACK_IDENTITY.teamId;
const id = () => randomUUID();

const people = {
  viewer: { userId: id(), slackUserId: 'UVIEWER', first: 'Viola', last: 'Viewer', team },
  member: { userId: id(), slackUserId: 'UMEMBER', first: 'Mette', last: 'Member', team },
  outsider: { userId: id(), slackUserId: 'UOUTSIDER', first: 'Otto', last: 'Outsider', team },
  newcomer: {
    userId: id(),
    slackUserId: 'UNEWCOMER',
    first: 'Nina',
    last: 'Newcomer',
    team,
    joined: '2026-09-23 08:00:00',
  },
  early: {
    userId: id(),
    slackUserId: 'UEARLY',
    first: 'Erik',
    last: 'Early',
    team,
    joined: '2026-09-24 08:00:00',
  },
  gone: { userId: id(), slackUserId: 'UGONE', first: 'Greta', last: 'Gone', team, off: true },
  unmapped: { userId: id(), slackUserId: null, first: 'Ulla', last: 'Unmapped', team },
  abroad: { userId: id(), slackUserId: 'UABROAD', first: 'Axel', last: 'Abroad', team: otherTeam },
  admin: {
    userId: id(),
    slackUserId: ADMIN_SLACK_IDENTITY.slackUserId,
    first: 'Ada',
    last: 'Admin',
    team: adminTeam,
  },
  impostor: {
    userId: id(),
    slackUserId: 'UIMPOSTOR',
    first: 'Ida',
    last: 'Impostor',
    team: adminTeam,
  },
  copycat: {
    userId: id(),
    slackUserId: ADMIN_SLACK_IDENTITY.slackUserId,
    first: 'Cora',
    last: 'Copycat',
    team: otherTeam,
  },
  grantee: {
    userId: id(),
    slackUserId: 'UGRANTEE',
    first: 'Gro',
    last: 'Grantee',
    team: adminTeam,
  },
  deactivated: {
    userId: id(),
    slackUserId: 'UDEACTIVATED',
    first: 'Dan',
    last: 'Deactivated',
    team: adminTeam,
    off: true,
  },
};
type Person = (typeof people)[keyof typeof people];
const everyone = Object.values(people);
const as = (person: Person) => vi.mocked(requireUserId).mockResolvedValue(person.userId);

const declaration = (person: Person, values: Partial<typeof status.$inferInsert>) => ({
  userID: person.userId,
  announcedAt: new Date('2026-09-18T08:00:00Z'),
  ...values,
});

describe.runIf(process.env.SLACK_TEST_DATABASE === '1')(
  'employee stats on isolated PostgreSQL',
  () => {
    beforeAll(async () => {
      if (process.env.PGHOST !== '127.0.0.1' || process.env.PGDATABASE !== 'work_slack_test')
        throw new Error('Dedicated local test database required');
      await db.insert(users).values(
        everyone.map((person) => ({
          userId: person.userId,
          email: `${person.userId}@example.com`,
          slackTeamId: person.team,
          slackUserId: person.slackUserId,
          slackDeactivated: 'off' in person,
          firstName: person.first,
          lastName: person.last,
          createdAt: 'joined' in person ? person.joined : '2026-01-01 00:00:00',
        }))
      );
      await db
        .insert(employeeStatsAccess)
        .values(
          [people.viewer, people.gone, people.unmapped, people.abroad, people.deactivated].map(
            (person) => ({ userId: person.userId, grantedByUserId: people.admin.userId })
          )
        );
      await db.insert(status).values([
        declaration(people.member, {
          status: 'VACATION',
          fromDate: '2026-09-21',
          toDate: '2026-09-22',
        }),
        declaration(people.viewer, {
          status: 'FROM_HOME',
          fromDate: '2026-09-23',
          toDate: '2026-09-23',
        }),
        declaration(people.gone, { status: 'SICK', fromDate: '2026-09-21', toDate: '2026-09-25' }),
        // Announced before they joined, so Erik is counted from the day they first announced.
        declaration(people.early, { status: 'SICK', fromDate: '2026-09-22', toDate: '2026-09-22' }),
        // Mette's record goes back well before the 90 days other views cover.
        declaration(people.member, {
          status: 'SICK',
          fromDate: '2025-03-03',
          toDate: '2025-03-05',
          announcedAt: new Date('2025-03-03T08:00:00Z'),
        }),
      ]);
    });
    beforeEach(() => {
      vi.stubEnv('SLACK_TEAM_ID', team);
    });
    afterAll(async () => {
      await db.delete(users).where(
        inArray(
          users.userId,
          everyone.map((person) => person.userId)
        )
      );
      vi.unstubAllEnvs();
      await pool.end();
    });

    it('lets an account view the stats only through a grant in an active workspace account', async () => {
      const verdicts = await Promise.all(
        [
          people.viewer,
          people.member,
          people.outsider,
          people.gone,
          people.unmapped,
          people.abroad,
        ].map(async (person) => [person, await canViewEmployeeStats(person.userId)] as const)
      );
      expect(verdicts.filter(([, can]) => can).map(([person]) => person.first)).toEqual(['Viola']);
    });

    it('recognizes the admin only by their Slack identity in the admin workspace', async () => {
      vi.stubEnv('SLACK_TEAM_ID', adminTeam);
      expect(await isEmployeeStatsAdmin(people.admin.userId)).toBe(true);
      expect(await canViewEmployeeStats(people.admin.userId)).toBe(true);
      expect(await isEmployeeStatsAdmin(people.impostor.userId)).toBe(false);
      expect(await canViewEmployeeStats(people.impostor.userId)).toBe(false);
      // The same Slack user id in another workspace is somebody else.
      expect(await isEmployeeStatsAdmin(people.copycat.userId)).toBe(false);
      // A granted viewer is not an admin, and a deactivated one is neither.
      expect(await isEmployeeStatsAdmin(people.deactivated.userId)).toBe(false);
      expect(await canViewEmployeeStats(people.deactivated.userId)).toBe(false);
    });

    it('denies the stats to everyone without a grant before reading any data', async () => {
      as(people.outsider);
      const select = vi.spyOn(db, 'select');
      await expect(getEmployeeStats({}, new Date('2026-09-25T10:00:00Z'))).rejects.toThrow(
        'NOT_FOUND'
      );
      // Only the permission lookup ran.
      expect(select).toHaveBeenCalledTimes(1);
      select.mockRestore();
    });

    const friday = new Date('2026-09-25T10:00:00Z');
    const countsByName = (employees: { name: string; counts: object }[]) =>
      Object.fromEntries(employees.map((employee) => [employee.name, employee.counts]));

    it('counts each active Slack member’s resolved workdays for a viewer', async () => {
      as(people.viewer);
      // Friday afternoon: the workdays are Monday 21 September to Friday 25 September.
      const stats = await getEmployeeStats({ days: '7' }, friday);
      expect(stats).toMatchObject({
        range: 7,
        startDate: '2026-09-19',
        endDate: '2026-09-25',
        workdays: 5,
        granularity: 'day',
      });
      expect(stats.employees.map((employee) => employee.name)).toEqual([
        'Erik Early',
        'Mette Member',
        'Nina Newcomer',
        'Otto Outsider',
        'Viola Viewer',
      ]);
      const byName = countsByName(stats.employees);
      expect(byName['Mette Member']).toMatchObject({ vacation: 2, office: 3 });
      expect(byName['Viola Viewer']).toMatchObject({ remote: 1, office: 4 });
      expect(byName['Otto Outsider']).toMatchObject({ office: 5 });
      expect(stats.totals.counts).toMatchObject({ office: 18, remote: 1, vacation: 2, sick: 1 });
      expect(stats.weekdays[2]?.counts).toMatchObject({ office: 4, remote: 1 });
      expect(stats.series).toHaveLength(5);
    });

    it('counts people only from the day they joined or first announced something', async () => {
      as(people.viewer);
      const byName = countsByName((await getEmployeeStats({ days: '7' }, friday)).employees);
      // Nina joined on Wednesday; Erik announced a sick day on Tuesday before joining.
      expect(byName['Nina Newcomer']).toMatchObject({ office: 3, sick: 0 });
      expect(byName['Erik Early']).toMatchObject({ office: 3, sick: 1 });
    });

    it('reaches back past 90 days, to where the history begins', async () => {
      as(people.viewer);
      const year = await getEmployeeStats({ days: '365' }, friday);
      expect(year).toMatchObject({ range: 365, granularity: 'week' });
      // A year back is September 2025, so Mette's March 2025 sick days are not in it yet.
      expect(countsByName(year.employees)['Mette Member']).toMatchObject({ sick: 0, vacation: 2 });

      const all = await getEmployeeStats({ days: 'all' }, friday);
      expect(all.range).toBe('all');
      // Mette's first announcement is the earliest record, a Monday.
      expect(all.startDate).toBe('2025-03-03');
      expect(all.granularity).toBe('month');
      const mette = all.employees.find((employee) => employee.name === 'Mette Member')!;
      const otto = all.employees.find((employee) => employee.name === 'Otto Outsider')!;
      // 410 workdays since 3 March 2025, against 192 since Otto joined on 1 January 2026.
      expect(mette.counts).toMatchObject({ sick: 3, vacation: 2, office: 405 });
      expect(otto.counts).toMatchObject({ office: 192 });
    });

    it('lists the people who can be looked up, alphabetically and only from the workspace', async () => {
      as(people.viewer);
      const listed = await listEmployees();
      expect(listed.map((person) => person.name)).toEqual([
        'Erik Early',
        'Mette Member',
        'Nina Newcomer',
        'Otto Outsider',
        'Viola Viewer',
      ]);
      expect(listed.every((person) => person.email && person.userId)).toBe(true);
    });

    it('shows one person against the norm of their colleagues', async () => {
      as(people.viewer);
      const profile = await getEmployeeProfile(
        { userId: people.member.userId, days: '7', compare: 'norm' },
        friday
      );
      expect(profile).toMatchObject({
        range: 7,
        compare: 'norm',
        employee: { name: 'Mette Member' },
        workdays: ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25'],
      });
      expect(profile!.person.totals.counts).toMatchObject({ vacation: 2, office: 3 });
      // The norm is everyone else, never the person themselves.
      expect(profile!.norm).not.toBeNull();
      expect(profile!.norm!.colleagues).toBe(4);
      expect(profile!.norm!.totals.counts).toMatchObject({ office: 15, remote: 1, sick: 1 });
      expect(profile!.norm!.totals.counts.vacation).toBe(0);
    });

    it('shows only the person, loading no colleagues, when asked', async () => {
      as(people.viewer);
      const profile = await getEmployeeProfile(
        { userId: people.member.userId, days: '7', compare: 'alone' },
        friday
      );
      expect(profile).toMatchObject({ compare: 'alone', norm: null, officeRank: null });
      expect(profile!.person.totals.counts).toMatchObject({ vacation: 2, office: 3 });
    });

    it('starts a profile where the person’s record starts', async () => {
      as(people.viewer);
      const profile = await getEmployeeProfile(
        { userId: people.newcomer.userId, days: '7' },
        friday
      );
      expect(profile!.workdays).toEqual(['2026-09-23', '2026-09-24', '2026-09-25']);
      // Before she joined, nobody else is compared to her either.
      expect(profile!.norm!.totals.counts).toMatchObject({ office: 11, remote: 1 });
    });

    it('knows nobody who is not an active member of this workspace', async () => {
      as(people.viewer);
      for (const person of [people.gone, people.abroad, people.unmapped]) {
        expect(await getEmployeeProfile({ userId: person.userId }, friday)).toBeNull();
      }
      expect(await getEmployeeProfile({ userId: id() }, friday)).toBeNull();
    });

    it('denies profiles and the directory to everyone without a grant', async () => {
      as(people.outsider);
      await expect(getEmployeeProfile({ userId: people.member.userId }, friday)).rejects.toThrow(
        'NOT_FOUND'
      );
      await expect(listEmployees()).rejects.toThrow('NOT_FOUND');
    });

    it('lets the admin grant and revoke access, and nobody else', async () => {
      vi.stubEnv('SLACK_TEAM_ID', adminTeam);
      const grantee = people.grantee.userId;
      const grants = () =>
        db.select().from(employeeStatsAccess).where(eq(employeeStatsAccess.userId, grantee));

      as(people.grantee);
      await expect(grantEmployeeStatsAccessAction({ userId: grantee })).rejects.toThrow(
        'NOT_FOUND'
      );
      expect(await grants()).toEqual([]);

      as(people.admin);
      expect(await grantEmployeeStatsAccessAction({ userId: grantee })).toEqual({ ok: true });
      const [first] = await grants();
      expect(first?.grantedByUserId).toBe(people.admin.userId);
      expect(await canViewEmployeeStats(grantee)).toBe(true);

      // A repeated grant keeps the original date.
      expect(await grantEmployeeStatsAccessAction({ userId: grantee })).toEqual({ ok: true });
      expect((await grants())[0]?.grantedAt).toEqual(first?.grantedAt);

      const list = await listEmployeeStatsAccess();
      const role = (person: Person) => list.find((entry) => entry.userId === person.userId)?.role;
      expect(role(people.admin)).toBe('admin');
      expect(role(people.grantee)).toBe('viewer');
      expect(role(people.impostor)).toBe('none');
      expect(role(people.deactivated)).toBeUndefined();
      expect(role(people.copycat)).toBeUndefined();
      expect(list.find((entry) => entry.userId === grantee)?.grantedBy).toBe('Ada Admin');

      // The viewer sees the stats page data but cannot manage access.
      as(people.grantee);
      await expect(listEmployeeStatsAccess()).rejects.toThrow('NOT_FOUND');
      await expect(revokeEmployeeStatsAccessAction({ userId: grantee })).rejects.toThrow(
        'NOT_FOUND'
      );
      expect(await grants()).toHaveLength(1);

      as(people.admin);
      expect(await revokeEmployeeStatsAccessAction({ userId: grantee })).toEqual({ ok: true });
      expect(await grants()).toEqual([]);
      expect(await canViewEmployeeStats(grantee)).toBe(false);
      expect(await revokeEmployeeStatsAccessAction({ userId: grantee })).toEqual({ ok: true });
    });

    it('refuses grants to deactivated people, other workspaces, unknown ids and the admin', async () => {
      vi.stubEnv('SLACK_TEAM_ID', adminTeam);
      as(people.admin);
      const refused = { ok: false, error: expect.any(String) };
      expect(await grantEmployeeStatsAccessAction({ userId: people.deactivated.userId })).toEqual(
        refused
      );
      expect(await grantEmployeeStatsAccessAction({ userId: people.copycat.userId })).toEqual(
        refused
      );
      expect(await grantEmployeeStatsAccessAction({ userId: id() })).toEqual(refused);
      expect(await grantEmployeeStatsAccessAction({ userId: people.admin.userId })).toEqual(
        refused
      );
      const rows = await db
        .select()
        .from(employeeStatsAccess)
        .where(eq(employeeStatsAccess.userId, people.admin.userId));
      expect(rows).toEqual([]);
    });

    it('drops a grant when the person is deleted', async () => {
      const doomed = { ...people.grantee, userId: id(), slackUserId: 'UDOOMED' };
      await db.insert(users).values({
        userId: doomed.userId,
        email: `${doomed.userId}@example.com`,
        slackTeamId: adminTeam,
        slackUserId: doomed.slackUserId,
      });
      await db.insert(employeeStatsAccess).values({ userId: doomed.userId });
      await db.delete(users).where(eq(users.userId, doomed.userId));
      expect(
        await db
          .select()
          .from(employeeStatsAccess)
          .where(eq(employeeStatsAccess.userId, doomed.userId))
      ).toEqual([]);
    });
  }
);
