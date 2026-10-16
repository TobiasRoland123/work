import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  slackAiUsage,
  slackMessageFeedback,
  slackMessages,
  statusCorrections,
  users,
} from '@/db/schema';
import type { UserStatus } from '@/db/types';
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
  expectedStatus: UserStatus | null;
  expectedStatusNote: string | null;
};

export type ReviewCorrection = {
  id: number;
  author: string;
  correctedAt: string;
  originalStatus: UserStatus | null;
  originalDetails: string | null;
  /** Slack text of the corrected revision, when it could be fetched. */
  sourceText: string | null;
  correctedStatus: UserStatus;
  fromDate: string;
  toDate: string;
  messageKey: string;
  /** The revision that produced the corrected Declaration, when the inbox identified it. */
  revision: string | null;
  /** The message's latest revision, or null after the inbox row was removed. */
  currentRevision: string | null;
  messageState: string | null;
  originalStatusId: number | null;
  correctionStatusId: number | null;
};

export type CorrectionPattern = {
  originalStatus: UserStatus | null;
  correctedStatus: UserStatus;
  corrections: number;
  people: number;
  lastCorrectedAt: string;
};

const PAGE_SIZE = 25;
const CORRECTION_LIMIT = 50;

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

const correctionWeek = sql<string>`to_char(date_trunc('week',
  ${statusCorrections.createdAt} at time zone 'Europe/Copenhagen'), 'YYYY-MM-DD')`;

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
  // Message keys are "team:channel:ts". Compare the prefix literally; IDs may contain "_".
  const correctionScope = sql`starts_with(${statusCorrections.sourceMessageKey}, ${`${process.env.SLACK_TEAM_ID ?? ''}:${process.env.SLACK_CHANNEL_ID ?? ''}:`})`;
  const [summaries, reasonRows, costRows, correctionRows, patternRows] = await Promise.all([
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
    db
      .select({
        id: statusCorrections.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        correctedAt: statusCorrections.createdAt,
        originalStatus: statusCorrections.originalStatus,
        originalDetails: statusCorrections.originalDetails,
        sourceText: statusCorrections.sourceText,
        correctedStatus: statusCorrections.correctedStatus,
        fromDate: statusCorrections.fromDate,
        toDate: statusCorrections.toDate,
        messageKey: statusCorrections.sourceMessageKey,
        revision: statusCorrections.sourceRevision,
        currentRevision: slackMessages.revision,
        messageState: slackMessages.state,
        originalStatusId: statusCorrections.originalStatusId,
        correctionStatusId: statusCorrections.correctionStatusId,
      })
      .from(statusCorrections)
      .leftJoin(users, eq(users.userId, statusCorrections.userId))
      .leftJoin(slackMessages, eq(slackMessages.messageKey, statusCorrections.sourceMessageKey))
      .where(and(correctionScope, sql`${correctionWeek} = ${selectedWeek}`))
      .orderBy(desc(statusCorrections.createdAt), desc(statusCorrections.id))
      .limit(CORRECTION_LIMIT),
    db
      .select({
        originalStatus: statusCorrections.originalStatus,
        correctedStatus: statusCorrections.correctedStatus,
        corrections: sql<number>`count(*)::integer`,
        people: sql<number>`count(distinct ${statusCorrections.userId})::integer`,
        lastCorrectedAt: sql<Date>`max(${statusCorrections.createdAt})`,
      })
      .from(statusCorrections)
      .where(correctionScope)
      .groupBy(statusCorrections.originalStatus, statusCorrections.correctedStatus)
      .orderBy(desc(sql`count(*)`), desc(sql`max(${statusCorrections.createdAt})`))
      .limit(10),
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
      expectedStatus: slackMessageFeedback.preferredStatus,
      expectedStatusNote: slackMessageFeedback.note,
    })
    .from(slackMessages)
    .leftJoin(
      users,
      and(
        eq(users.slackTeamId, slackMessages.teamId),
        eq(users.slackUserId, slackMessages.slackUserId)
      )
    )
    .leftJoin(
      slackMessageFeedback,
      and(
        eq(slackMessageFeedback.messageKey, slackMessages.messageKey),
        eq(slackMessageFeedback.revision, slackMessages.revision)
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
  const corrections: ReviewCorrection[] = correctionRows.map(
    ({ firstName, lastName, email, correctedAt, ...row }) => ({
      ...row,
      author: [firstName, lastName].filter(Boolean).join(' ') || email || 'Unknown person',
      correctedAt: correctedAt.toISOString(),
    })
  );
  const correctionPatterns: CorrectionPattern[] = patternRows.map((row) => ({
    ...row,
    lastCorrectedAt: new Date(row.lastCorrectedAt).toISOString(),
  }));
  return {
    selectedWeek,
    weeks: weekStarts.map(summary),
    selectedSummary: summary(selectedWeek),
    dailyCosts,
    messages,
    corrections,
    correctionPatterns,
    correctionLimit: CORRECTION_LIMIT,
    reasons,
    reason: selectedReason,
    page,
    pageSize: PAGE_SIZE,
    totalMessages,
    totalPages,
  };
}
