import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db, pool } from '@/db';
import { status, users } from '@/db/schema';
import { requireUserId } from '@/lib/auth/require-user';
import { ADMIN_SLACK_IDENTITY } from '@/lib/auth/admin-identity';
import { canViewEmployeeStats, isEmployeeStatsAdmin } from '@/lib/auth/employee-stats';
import { listUserRoles } from '@/lib/admin/roles';
import { canReviewMessages } from '@/lib/auth/message-review';
import { getEmployeeProfile, getEmployeeStats, listEmployees } from '@/lib/employee-stats/service';
import { changeUserRoleAction } from '@/app/actions/roleActions';

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
          systemRole:
            person === people.admin
              ? ('ADMIN' as const)
              : [
                    people.viewer.userId,
                    people.gone.userId,
                    people.unmapped.userId,
                    people.abroad.userId,
                    people.deactivated.userId,
                  ].includes(person.userId)
                ? ('MANAGER' as const)
                : ('EMPLOYEE' as const),
          createdAt: 'joined' in person ? person.joined : '2026-01-01 00:00:00',
        }))
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

    it('lets an account view the stats only through a manager role in an active workspace account', async () => {
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

    it('recognizes admins by their persisted role in the configured workspace', async () => {
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

    it('denies the stats to everyone without a manager or admin role before reading any data', async () => {
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

    it('denies profiles and the directory to everyone without a manager or admin role', async () => {
      as(people.outsider);
      await expect(getEmployeeProfile({ userId: people.member.userId }, friday)).rejects.toThrow(
        'NOT_FOUND'
      );
      await expect(listEmployees()).rejects.toThrow('NOT_FOUND');
    });

    it('lets admins promote managers and admins, with immediate permission changes', async () => {
      vi.stubEnv('SLACK_TEAM_ID', adminTeam);
      const userId = people.grantee.userId;
      as(people.admin);
      expect(await changeUserRoleAction({ userId, role: 'MANAGER' })).toEqual({ ok: true });
      expect(await canViewEmployeeStats(userId)).toBe(true);
      expect(await canReviewMessages(userId)).toBe(false);
      expect(await isEmployeeStatsAdmin(userId)).toBe(false);
      const roles = await listUserRoles();
      expect(roles.find((entry) => entry.userId === userId)?.role).toBe('MANAGER');
      expect(roles.find((entry) => entry.userId === people.copycat.userId)).toBeUndefined();
      expect(roles.find((entry) => entry.userId === people.deactivated.userId)).toBeUndefined();

      as(people.grantee);
      await expect(listUserRoles()).rejects.toThrow('NOT_FOUND');
      await expect(
        changeUserRoleAction({ userId: people.impostor.userId, role: 'ADMIN' })
      ).rejects.toThrow('NOT_FOUND');

      as(people.admin);
      expect(await changeUserRoleAction({ userId, role: 'ADMIN' })).toEqual({ ok: true });
      expect(await canReviewMessages(userId)).toBe(true);
      // A newly promoted admin can manage roles without the bootstrap Slack identity.
      as(people.grantee);
      expect(
        await changeUserRoleAction({ userId: people.impostor.userId, role: 'MANAGER' })
      ).toEqual({ ok: true });
      as(people.admin);
      expect(await changeUserRoleAction({ userId, role: 'EMPLOYEE' })).toEqual({ ok: true });
      expect(await canViewEmployeeStats(userId)).toBe(false);
      expect(await canReviewMessages(userId)).toBe(false);
      await expect(changeUserRoleAction({ userId, role: 'ADMIN' })).resolves.toEqual({ ok: true });
      // Two admins trying to demote each other cannot remove both admins.
      const actor = vi.mocked(requireUserId);
      actor.mockResolvedValueOnce(people.admin.userId).mockResolvedValueOnce(userId);
      const changes = await Promise.all([
        changeUserRoleAction({ userId, role: 'EMPLOYEE' }),
        changeUserRoleAction({ userId: people.admin.userId, role: 'EMPLOYEE' }),
      ]);
      expect(changes.filter((change) => change.ok)).toHaveLength(1);
      expect(
        (
          await db
            .select()
            .from(users)
            .where(inArray(users.userId, [userId, people.admin.userId]))
        ).filter((person) => person.systemRole === 'ADMIN')
      ).toHaveLength(1);
    });

    it('rejects self changes, inactive or foreign accounts, unknown users and invalid roles', async () => {
      vi.stubEnv('SLACK_TEAM_ID', adminTeam);
      // Previous race may have demoted the original fixture admin. Restore fixture roles.
      await db
        .update(users)
        .set({ systemRole: 'ADMIN' })
        .where(eq(users.userId, people.admin.userId));
      as(people.admin);
      for (const userId of [
        people.deactivated.userId,
        people.copycat.userId,
        id(),
        people.admin.userId,
      ]) {
        expect(await changeUserRoleAction({ userId, role: 'ADMIN' })).toMatchObject({ ok: false });
      }
      expect(
        await changeUserRoleAction({ userId: people.grantee.userId, role: 'OWNER' })
      ).toMatchObject({ ok: false });
    });
  }
);
