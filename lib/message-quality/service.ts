import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import { slackAiUsage, slackMessages, users } from '@/db/schema';
import { requireMessageReviewer } from '@/lib/auth/message-review';
import {
  addAiCosts,
  calendarWeekDays,
  emptyAiCost,
  messageWeek,
  shiftCalendarWeek,
  weeklyConversion,
} from './stats';
import type { AiCostSummary, DailyAiCost } from './stats';
export type { AiCostSummary, DailyAiCost, WeeklyConversion } from './stats';

export type ReviewMessage = {
  messageKey: string;
  revision: string;
  author: string;
  slackUserId: string | null;
  announcedAt: string;
  receivedAt: string;
  processedAt: string | null;
  text: string | null;
  state: string;
  reason: string;
  failureReason: string | null;
  attempts: number;
};

const PAGE_SIZE = 25;

// Keep the legacy fallback for local databases upgraded with schema push rather than migration.
// A clear, applied extraction produced a status. Other terminal outcomes did not, even
// when an older status was preserved after an uncertain edit. Never join mutable status rows.
const conversion = sql<boolean | null>`coalesce(${slackMessages.convertedToStatus}, case
  when ${slackMessages.state} = 'applied' and ${slackMessages.outcome}->>'reason' = 'clear' then true
  when ${slackMessages.state} in ('applied', 'review', 'ignored')
    and ${slackMessages.outcome}->>'reason' is not null then false
  else null end)`;
const week = sql<string>`to_char(date_trunc('week',
  to_timestamp(${slackMessages.messageTs}::double precision) at time zone 'Europe/Copenhagen'), 'YYYY-MM-DD')`;
const reason = sql<string>`coalesce(${slackMessages.outcome}->>'reason', 'not_recorded')`;
const unconverted = sql`${slackMessages.state} in ('applied', 'review', 'ignored') and ${conversion} is not true`;

const costDay = sql<string>`to_char(${slackAiUsage.startedAt} at time zone 'Europe/Copenhagen', 'YYYY-MM-DD')`;

function costDateRange(start: string, end: string) {
  return sql`${slackAiUsage.startedAt} >= (${start}::date::timestamp at time zone 'Europe/Copenhagen')
    and ${slackAiUsage.startedAt} < (${end}::date::timestamp at time zone 'Europe/Copenhagen')`;
}

export async function getMessageQualityDashboard(
  input: { week?: string; reason?: string; page?: string } = {},
  now: Date = new Date()
) {
  // This check belongs at the read boundary too: importing this function must never bypass it.
  await requireMessageReviewer();
  const selectedWeek = messageWeek(input.week, now);
  const currentWeek = messageWeek(undefined, now);
  const weekStarts = Array.from({ length: 12 }, (_, index) =>
    shiftCalendarWeek(currentWeek, -index)
  );
  const scope = and(
    eq(slackMessages.teamId, process.env.SLACK_TEAM_ID ?? ''),
    eq(slackMessages.channelId, process.env.SLACK_CHANNEL_ID ?? ''),
    ne(slackMessages.state, 'deleted')
  );
  const selectedScope = and(scope, sql`${week} = ${selectedWeek}`, unconverted);
  const [summaries, reasonRows, costRows] = await Promise.all([
    db
      .select({
        weekStart: week,
        total: sql<number>`count(*)::integer`,
        converted: sql<number>`count(*) filter (where ${conversion} is true)::integer`,
        unconverted: sql<number>`count(*) filter (where ${conversion} is false)::integer`,
        pending: sql<number>`count(*) filter (where ${slackMessages.state} = 'pending')::integer`,
        unknown: sql<number>`count(*) filter (where ${conversion} is null and ${slackMessages.state} <> 'pending')::integer`,
      })
      .from(slackMessages)
      .where(
        and(
          scope,
          sql`(${week} between ${weekStarts[11]} and ${currentWeek} or ${week} = ${selectedWeek})`
        )
      )
      .groupBy(week),
    db
      .select({ reason, count: sql<number>`count(*)::integer` })
      .from(slackMessages)
      .where(selectedScope)
      .groupBy(reason)
      .orderBy(reason),
    db
      .select({
        date: costDay,
        costUsd: sql<string | null>`sum(${slackAiUsage.costUsd})`,
        calls: sql<number>`count(*)::integer`,
        unpricedCalls: sql<number>`count(*) filter (where ${slackAiUsage.costUsd} is null)::integer`,
      })
      .from(slackAiUsage)
      .where(
        and(
          eq(slackAiUsage.teamId, process.env.SLACK_TEAM_ID ?? ''),
          eq(slackAiUsage.channelId, process.env.SLACK_CHANNEL_ID ?? ''),
          sql`((${costDateRange(weekStarts[11], shiftCalendarWeek(currentWeek, 1))}) or (${costDateRange(selectedWeek, shiftCalendarWeek(selectedWeek, 1))}))`
        )
      )
      .groupBy(costDay),
  ]);
  const reasons = reasonRows.map((row) => row.reason);
  const selectedReason = input.reason && reasons.includes(input.reason) ? input.reason : '';
  const totalMessages = reasonRows.reduce(
    (total, row) =>
      total + (!selectedReason || row.reason === selectedReason ? Number(row.count) : 0),
    0
  );
  const totalPages = Math.max(1, Math.ceil(totalMessages / PAGE_SIZE));
  const requestedPage = Number(input.page ?? 1);
  const page = Math.min(
    totalPages,
    Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  );
  const rows = await db
    .select({
      messageKey: slackMessages.messageKey,
      revision: slackMessages.revision,
      slackUserId: slackMessages.slackUserId,
      firstName: users.firstName,
      lastName: users.lastName,
      messageTs: slackMessages.messageTs,
      receivedAt: slackMessages.receivedAt,
      processedAt: slackMessages.processedAt,
      text: slackMessages.reviewText,
      state: slackMessages.state,
      reason,
      failureReason: sql<string | null>`${slackMessages.outcome}->>'failureReason'`,
      attempts: slackMessages.attempts,
    })
    .from(slackMessages)
    .leftJoin(
      users,
      and(
        eq(users.slackTeamId, slackMessages.teamId),
        eq(users.slackUserId, slackMessages.slackUserId)
      )
    )
    .where(and(selectedScope, selectedReason ? sql`${reason} = ${selectedReason}` : undefined))
    .orderBy(desc(sql`${slackMessages.messageTs}::numeric`), desc(slackMessages.messageKey))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);
  const costByDay = new Map<string, DailyAiCost>();
  const costByWeek = new Map<string, AiCostSummary>();
  for (const row of costRows) {
    const cost = { ...row, costUsd: row.costUsd === null ? null : Number(row.costUsd) };
    costByDay.set(row.date, cost);
    const weekStart = messageWeek(row.date);
    costByWeek.set(weekStart, addAiCosts(costByWeek.get(weekStart) ?? emptyAiCost(), cost));
  }
  const summaryByWeek = new Map(
    summaries.map((row) => [
      row.weekStart,
      weeklyConversion(row.weekStart, row, costByWeek.get(row.weekStart)),
    ])
  );
  const summary = (weekStart: string) =>
    summaryByWeek.get(weekStart) ?? weeklyConversion(weekStart, {}, costByWeek.get(weekStart));
  const dailyCosts = calendarWeekDays(selectedWeek).map(
    (date) => costByDay.get(date) ?? { date, ...emptyAiCost() }
  );
  const messages: ReviewMessage[] = rows.map(({ firstName, lastName, messageTs, ...row }) => ({
    ...row,
    author: [firstName, lastName].filter(Boolean).join(' ') || row.slackUserId || 'Unknown author',
    announcedAt: new Date(Number(messageTs) * 1000).toISOString(),
    receivedAt: row.receivedAt.toISOString(),
    processedAt: row.processedAt?.toISOString() ?? null,
  }));
  return {
    selectedWeek,
    weeks: weekStarts.map(summary),
    selectedSummary: summary(selectedWeek),
    dailyCosts,
    messages,
    reasons,
    reason: selectedReason,
    page,
    pageSize: PAGE_SIZE,
    totalMessages,
    totalPages,
  };
}
