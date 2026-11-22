import { and, eq, gt, gte, inArray, isNotNull, isNull, lte, or, sql } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { db } from '@/db';
import { status, users } from '@/db/schema';
import type { Status } from '@/db/types';
import { requireUserId } from '@/lib/auth/require-user';
import { activeWorkspaceMember, getUserRole } from '@/lib/auth/roles';
import {
  STATS_START_DATE,
  calendarDays,
  startedWorkdays,
  trackedFrom,
} from '@/lib/employee-stats/stats';
import { copenhagenDate, copenhagenWallClock } from '@/lib/status/active';
import { visibleStatusCondition } from '@/lib/status/visible';
import { addDays } from '@/lib/status/week';
import { personalStatsRange, resolveRecordedDays, summarizePersonalStats } from './stats';
import type { PersonalStats } from './types';

export type { PersonalStats } from './types';

/**
 * Inclusive date declarations overlap the window; clock-only declarations use their instants.
 * One extra day on either side retains declarations ending at a midnight boundary. Undated,
 * untimed notes are bounded by their announcement rather than loading the entire history.
 */
export function attendanceWindowCondition(startDate: string, endDate: string) {
  const first = addDays(startDate, -1);
  const last = addDays(endDate, 1);
  const firstInstant = copenhagenWallClock(first, 0, 0);
  const endInstant = copenhagenWallClock(addDays(last, 1), 0, 0);
  const announced = sql`coalesce(${status.announcedAt}, ${status.createdAt} at time zone 'Europe/Copenhagen')`;
  return or(
    and(
      or(isNotNull(status.fromDate), isNotNull(status.toDate)),
      or(isNull(status.toDate), gte(status.toDate, first)),
      or(isNull(status.fromDate), lte(status.fromDate, last))
    ),
    and(
      isNull(status.fromDate),
      isNull(status.toDate),
      or(
        and(
          or(isNotNull(status.startsAt), isNotNull(status.endsAt)),
          or(isNull(status.endsAt), gte(status.endsAt, firstInstant)),
          or(isNull(status.startsAt), lte(status.startsAt, endInstant))
        ),
        and(
          isNull(status.startsAt),
          isNull(status.endsAt),
          gte(announced, firstInstant),
          lte(announced, endInstant)
        )
      )
    )
  );
}

/** Self only. A target user ID is deliberately absent from this API. */
export async function getPersonalStats(
  input: { days?: string; compare?: string } = {},
  now: Date = new Date()
): Promise<PersonalStats> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    notFound();
  }
  if (!(await getUserRole(userId))) redirect('/permission-denied');

  const range = personalStatsRange(input.days);
  const comparison = input.compare !== 'off' && input.compare !== 'alone';
  const teamId = process.env.SLACK_TEAM_ID;
  if (!teamId) redirect('/permission-denied');
  const members = await db
    .select({ userId: users.userId, createdAt: users.createdAt })
    .from(users)
    .where(and(activeWorkspaceMember(teamId), comparison ? undefined : eq(users.userId, userId)));
  const subject = members.find((member) => member.userId === userId);
  if (!subject) redirect('/permission-denied');
  const userIds = members.map((member) => member.userId);

  const localDay = (column: AnyPgColumn) =>
    sql`min((${column} at time zone 'Europe/Copenhagen')::date)`;
  const firstRows = await db
    .select({
      userId: status.userID,
      firstDay: sql<
        string | null
      >`to_char(least(min(${status.fromDate}), ${localDay(status.startsAt)}, ${localDay(status.endsAt)}, min(case when ${status.fromDate} is null and ${status.toDate} is null and ${status.startsAt} is null and ${status.endsAt} is null then (coalesce(${status.announcedAt}, ${status.createdAt} at time zone 'Europe/Copenhagen') at time zone 'Europe/Copenhagen')::date end)), 'YYYY-MM-DD')`,
    })
    .from(status)
    .where(
      and(
        inArray(status.userID, userIds),
        gt(status.id, 0),
        isNotNull(status.status),
        visibleStatusCondition()
      )
    )
    .groupBy(status.userID);
  const firstAnnounced = new Map(firstRows.map((row) => [row.userId, row.firstDay]));
  const starts = new Map(
    members.map((member) => [
      member.userId,
      trackedFrom(member.createdAt, firstAnnounced.get(member.userId) ?? null),
    ])
  );
  const calendar = calendarDays(range, now);
  const startDate = calendar[0]! < STATS_START_DATE ? STATS_START_DATE : calendar[0]!;
  const endDate = copenhagenDate(now);
  // Compare both sides on the subject's eligible weekdays, respecting each colleague's join date.
  const workdays = startedWorkdays(calendar, now).filter((day) => day >= starts.get(userId)!);
  const rows = workdays.length
    ? await db
        .select()
        .from(status)
        .where(
          and(
            inArray(status.userID, userIds),
            gt(status.id, 0),
            visibleStatusCondition(),
            attendanceWindowCondition(workdays[0]!, endDate)
          )
        )
    : [];
  const statusesByUser = new Map<string, Status[]>();
  for (const row of rows) {
    const statuses = statusesByUser.get(row.userID) ?? [];
    statuses.push(row);
    statusesByUser.set(row.userID, statuses);
  }
  const person = (id: string) => ({
    days: resolveRecordedDays(statusesByUser.get(id) ?? [], id, workdays, starts.get(id)!, now),
  });
  return summarizePersonalStats({
    range,
    comparison,
    startDate: workdays[0] ?? startDate,
    endDate,
    workdays,
    own: person(userId),
    colleagues: comparison
      ? members.filter((member) => member.userId !== userId).map((member) => person(member.userId))
      : [],
  });
}
