import { and, eq, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { db } from '@/db';
import { slackAiUsage, slackMessageProcessing } from '@/db/schema';
import { requireMessageReviewer } from '@/lib/auth/message-review';
import {
  addAiUsage,
  aiCostPeriod,
  aiUsageFromRow,
  calendarMonths,
  emptyAiUsage,
  periodDays,
  shiftDate,
} from './stats';
import type { AiUsageTotals, DailyAiUsage, ModelAiUsage } from './stats';
export type { AiCostPeriod, AiUsageTotals, DailyAiUsage, ModelAiUsage } from './stats';

const usageColumns = {
  costUsd: sql<string | null>`sum(${slackAiUsage.costUsd})`,
  calls: sql<number>`count(*)::integer`,
  unpricedCalls: sql<number>`count(*) filter (where ${slackAiUsage.costUsd} is null)::integer`,
  failedCalls: sql<number>`count(*) filter (where ${slackAiUsage.state} = 'failed')::integer`,
  inputTokens: sql<string | null>`sum(${slackAiUsage.inputTokens})`,
  outputTokens: sql<string | null>`sum(${slackAiUsage.outputTokens})`,
};

// A later failed edit can use AI after a message was first handled without it.
const messageUsedAi = sql`(${slackMessageProcessing.usedAi} or exists (
  select 1 from ${slackAiUsage}
  where ${slackAiUsage.messageKey} = ${slackMessageProcessing.messageKey}
))`;

const usageDay = sql<string>`to_char(${slackAiUsage.startedAt} at time zone 'Europe/Copenhagen', 'YYYY-MM-DD')`;
const usageMonth = sql<string>`to_char(${slackAiUsage.startedAt} at time zone 'Europe/Copenhagen', 'YYYY-MM-01')`;

/** Requests started on or after the start day and before the end day, in Copenhagen time. */
function startedBetween(start: string, end: string): SQL {
  return sql`${slackAiUsage.startedAt} >= (${start}::date::timestamp at time zone 'Europe/Copenhagen')
    and ${slackAiUsage.startedAt} < (${end}::date::timestamp at time zone 'Europe/Copenhagen')`;
}

export async function getAiCostDashboard(input: { days?: string } = {}, now: Date = new Date()) {
  // Check at the read boundary too: importing this function must never bypass the permission.
  await requireMessageReviewer();
  const days = aiCostPeriod(input.days);
  const dates = periodDays(days, now);
  const months = calendarMonths(now);
  const tomorrow = shiftDate(months.today, 1);
  const scope = and(
    eq(slackAiUsage.teamId, process.env.SLACK_TEAM_ID ?? ''),
    eq(slackAiUsage.channelId, process.env.SLACK_CHANNEL_ID ?? '')
  );
  const periodScope = and(scope, startedBetween(dates[0], tomorrow));

  const [dailyRows, modelRows, monthRows, [messageRow]] = await Promise.all([
    db
      .select({ date: usageDay, ...usageColumns })
      .from(slackAiUsage)
      .where(periodScope)
      .groupBy(usageDay),
    db
      .select({ model: slackAiUsage.model, ...usageColumns })
      .from(slackAiUsage)
      .where(periodScope)
      .groupBy(slackAiUsage.model)
      .orderBy(sql`sum(${slackAiUsage.costUsd}) desc nulls last`, slackAiUsage.model),
    db
      .select({ month: usageMonth, ...usageColumns })
      .from(slackAiUsage)
      .where(and(scope, startedBetween(months.previous, tomorrow)))
      .groupBy(usageMonth),
    db
      .select({
        ai: sql<number>`count(*) filter (where ${messageUsedAi})::integer`,
        withoutAi: sql<number>`count(*) filter (where not ${messageUsedAi})::integer`,
        total: sql<number>`count(*)::integer`,
      })
      .from(slackMessageProcessing)
      .where(
        and(
          eq(slackMessageProcessing.teamId, process.env.SLACK_TEAM_ID ?? ''),
          eq(slackMessageProcessing.channelId, process.env.SLACK_CHANNEL_ID ?? ''),
          sql`${slackMessageProcessing.handledAt} >= (${dates[0]}::date::timestamp at time zone 'Europe/Copenhagen')
          and ${slackMessageProcessing.handledAt} < (${tomorrow}::date::timestamp at time zone 'Europe/Copenhagen')`
        )
      ),
  ]);

  const byDay = new Map(dailyRows.map((row) => [row.date, aiUsageFromRow(row)]));
  const daily: DailyAiUsage[] = dates.map((date) => ({
    date,
    ...(byDay.get(date) ?? emptyAiUsage()),
  }));
  const models: ModelAiUsage[] = modelRows.map((row) => ({
    model: row.model,
    ...aiUsageFromRow(row),
  }));
  const byMonth = new Map(monthRows.map((row) => [row.month, aiUsageFromRow(row)]));
  const totals: AiUsageTotals = daily.reduce<AiUsageTotals>(addAiUsage, emptyAiUsage());

  return {
    days,
    startDate: dates[0],
    endDate: months.today,
    totals,
    messages: messageRow ?? { ai: 0, withoutAi: 0, total: 0 },
    daily,
    models,
    currentMonth: { start: months.current, ...(byMonth.get(months.current) ?? emptyAiUsage()) },
    previousMonth: {
      start: months.previous,
      ...(byMonth.get(months.previous) ?? emptyAiUsage()),
    },
  };
}
