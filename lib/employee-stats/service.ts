import { and, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { db } from '@/db';
import { status, users } from '@/db/schema';
import type { Status } from '@/db/types';
import { activeWorkspaceMember, requireEmployeeStatsViewer } from '@/lib/auth/employee-stats';
import { copenhagenDate } from '@/lib/status/active';
import { addDays } from '@/lib/status/week';
import { bucketWorkdays, buildProfile, officeShareSpread, seriesFor } from './history';
import {
  MAX_HISTORY_DAYS,
  calendarDays,
  calendarSpan,
  employeeSort,
  employeeStatsRange,
  resolveEmployeeCodes,
  startedWorkdays,
  summarizeEmployeeStats,
  trackedFrom,
} from './stats';
import type { EmployeeStatsRange, PersonDays } from './stats';

export type { EmployeeStats } from './stats';

export const COMPARISONS = ['norm', 'alone'] as const;
export type Comparison = (typeof COMPARISONS)[number];

export const employeeComparison = (value: unknown): Comparison =>
  COMPARISONS.find((comparison) => comparison === value) ?? 'norm';

const displayName = (firstName: string | null, lastName: string | null, email: string) =>
  [firstName, lastName].filter(Boolean).join(' ') || email;

const activeMembers = () =>
  db
    .select({
      userId: users.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(activeWorkspaceMember(process.env.SLACK_TEAM_ID ?? ''));

/**
 * Every active Slack member's resolved workdays over a range. Only active Slack members count:
 * accounts without a Slack mapping never announce anything, so the Workday Default would count
 * them as in the office every day. Each person is counted from the day they first appear.
 */
async function loadAttendance(range: EmployeeStatsRange, now: Date) {
  const members = await activeMembers();
  const today = copenhagenDate(now);
  const empty = { workdays: [] as string[], startDate: today, people: [] as PersonDays[] };
  if (members.length === 0) return empty;
  const userIds = members.map((member) => member.userId);

  // The earliest day each person announced anything, over their whole history.
  const earliestDay = (column: AnyPgColumn) =>
    sql`min((${column} at time zone 'Europe/Copenhagen')::date)`;
  const firstRows = await db
    .select({
      userId: status.userID,
      firstDay: sql<
        string | null
      >`to_char(least(min(${status.fromDate}), ${earliestDay(status.startsAt)}, ${earliestDay(status.endsAt)}), 'YYYY-MM-DD')`,
    })
    .from(status)
    .where(inArray(status.userID, userIds))
    .groupBy(status.userID);
  const firstAnnounced = new Map(firstRows.map((row) => [row.userId, row.firstDay]));
  const starts = new Map(
    members.map((member) => [
      member.userId,
      trackedFrom(member.createdAt, firstAnnounced.get(member.userId) ?? null),
    ])
  );

  const floor = addDays(today, 1 - MAX_HISTORY_DAYS);
  const first =
    range === 'all'
      ? [...starts.values()].reduce((a, b) => (a < b ? a : b))
      : calendarDays(range, now)[0]!;
  const calendar = calendarSpan(first < floor ? floor : first, today);
  const workdays = startedWorkdays(calendar, now);
  if (workdays.length === 0) return { ...empty, startDate: calendar[0]! };

  // A day can be settled by a declaration that ends at midnight, so read one day either side.
  const statusRows = await db
    .select()
    .from(status)
    .where(
      and(
        inArray(status.userID, userIds),
        or(isNull(status.toDate), gte(status.toDate, addDays(calendar[0]!, -1))),
        or(isNull(status.fromDate), lte(status.fromDate, addDays(today, 1)))
      )
    );
  const statusesByUser = new Map<string, Status[]>();
  for (const row of statusRows) {
    const rows = statusesByUser.get(row.userID) ?? [];
    rows.push(row);
    statusesByUser.set(row.userID, rows);
  }

  const people: PersonDays[] = members.map(({ firstName, lastName, email, userId }) => ({
    userId,
    email,
    name: displayName(firstName, lastName, email),
    codes: resolveEmployeeCodes(
      statusesByUser.get(userId) ?? [],
      userId,
      workdays,
      starts.get(userId)!,
      now
    ),
  }));
  return { workdays, startDate: calendar[0]!, people };
}

/** The company overview: totals, the trend over time and one row per employee. */
export async function getEmployeeStats(
  input: { days?: string; sort?: string } = {},
  now: Date = new Date()
) {
  // Check at the read boundary too: importing this function must never bypass the permission.
  await requireEmployeeStatsViewer();
  const range = employeeStatsRange(input.days);
  const sort = employeeSort(input.sort);
  const { workdays, startDate, people } = await loadAttendance(range, now);
  const { granularity, buckets } = bucketWorkdays(workdays);

  return {
    range,
    sort,
    startDate,
    endDate: copenhagenDate(now),
    workdays: workdays.length,
    granularity,
    series: seriesFor(people, buckets),
    spread: officeShareSpread(people, buckets),
    ...summarizeEmployeeStats(people, workdays, sort),
  };
}

/** Everyone who can be looked up, by name. */
export async function listEmployees() {
  await requireEmployeeStatsViewer();
  const members = await activeMembers();
  return members
    .map(({ userId, firstName, lastName, email }) => ({
      userId,
      email,
      name: displayName(firstName, lastName, email),
    }))
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) ||
        a.userId.localeCompare(b.userId)
    );
}

/**
 * One employee, optionally against their colleagues. Null when the person is not an active
 * member, for example from a stale link.
 */
export async function getEmployeeProfile(
  input: { userId: string; days?: string; compare?: string },
  now: Date = new Date()
) {
  await requireEmployeeStatsViewer();
  const range = employeeStatsRange(input.days);
  const compare = employeeComparison(input.compare);
  const { workdays, people } = await loadAttendance(range, now);
  const subject = people.find((person) => person.userId === input.userId);
  if (!subject) return null;

  const profile = buildProfile(
    workdays,
    subject,
    // Individual only: leave the colleagues out so nothing about them is even computed.
    compare === 'norm' ? people.filter((person) => person.userId !== subject.userId) : []
  );
  return {
    range,
    compare,
    endDate: copenhagenDate(now),
    employee: { userId: subject.userId, name: subject.name, email: subject.email },
    ...profile,
  };
}
