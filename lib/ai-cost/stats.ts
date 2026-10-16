import { copenhagenDate } from '@/lib/status/active';

export const AI_COST_PERIODS = [7, 30, 90] as const;
export type AiCostPeriod = (typeof AI_COST_PERIODS)[number];
export const DEFAULT_AI_COST_PERIOD: AiCostPeriod = 30;

export type AiUsageTotals = {
  costUsd: number | null;
  calls: number;
  unpricedCalls: number;
  failedCalls: number;
  inputTokens: number;
  outputTokens: number;
};

export type DailyAiUsage = AiUsageTotals & { date: string };
export type ModelAiUsage = AiUsageTotals & { model: string };

/** Raw aggregate row from PostgreSQL, where sums of numeric and bigint arrive as strings. */
export type AiUsageRow = {
  costUsd: string | number | null;
  calls: number | string;
  unpricedCalls: number | string;
  failedCalls: number | string;
  inputTokens: number | string | null;
  outputTokens: number | string | null;
};

export function emptyAiUsage(): AiUsageTotals {
  return {
    costUsd: null,
    calls: 0,
    unpricedCalls: 0,
    failedCalls: 0,
    inputTokens: 0,
    outputTokens: 0,
  };
}

export function aiUsageFromRow(row: AiUsageRow): AiUsageTotals {
  return {
    costUsd: row.costUsd === null ? null : Number(row.costUsd),
    calls: Number(row.calls),
    unpricedCalls: Number(row.unpricedCalls),
    failedCalls: Number(row.failedCalls),
    inputTokens: Number(row.inputTokens ?? 0),
    outputTokens: Number(row.outputTokens ?? 0),
  };
}

export function addAiUsage(first: AiUsageTotals, second: AiUsageTotals): AiUsageTotals {
  return {
    costUsd:
      first.costUsd === null && second.costUsd === null
        ? null
        : (first.costUsd ?? 0) + (second.costUsd ?? 0),
    calls: first.calls + second.calls,
    unpricedCalls: first.unpricedCalls + second.unpricedCalls,
    failedCalls: first.failedCalls + second.failedCalls,
    inputTokens: first.inputTokens + second.inputTokens,
    outputTokens: first.outputTokens + second.outputTokens,
  };
}

/** Average reported cost of the calls that have one. Including unpriced calls would understate it. */
export function averageCostPerPricedCall({ costUsd, calls, unpricedCalls }: AiUsageTotals) {
  const priced = calls - unpricedCalls;
  return costUsd === null || priced <= 0 ? null : costUsd / priced;
}

export function aiCostPeriod(value: unknown): AiCostPeriod {
  const days = typeof value === 'string' ? Number(value) : NaN;
  return AI_COST_PERIODS.find((period) => period === days) ?? DEFAULT_AI_COST_PERIOD;
}

export function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** The Copenhagen calendar days of a period ending today, oldest first. */
export function periodDays(days: number, now: Date = new Date()): string[] {
  const today = copenhagenDate(now);
  return Array.from({ length: days }, (_, index) => shiftDate(today, index - days + 1));
}

/** Today and the first day of the current and previous Copenhagen calendar months. */
export function calendarMonths(now: Date = new Date()) {
  const today = copenhagenDate(now);
  const current = `${today.slice(0, 7)}-01`;
  const previous = `${shiftDate(current, -1).slice(0, 7)}-01`;
  return { today, current, previous };
}
