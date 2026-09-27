import { copenhagenDate } from '@/lib/status/active';

export type AiCostSummary = {
  costUsd: number | null;
  calls: number;
  unpricedCalls: number;
};

export type DailyAiCost = AiCostSummary & { date: string };

export function emptyAiCost(): AiCostSummary {
  return { costUsd: null, calls: 0, unpricedCalls: 0 };
}

export function addAiCosts(first: AiCostSummary, second: AiCostSummary): AiCostSummary {
  return {
    costUsd:
      first.costUsd === null && second.costUsd === null
        ? null
        : (first.costUsd ?? 0) + (second.costUsd ?? 0),
    calls: first.calls + second.calls,
    unpricedCalls: first.unpricedCalls + second.unpricedCalls,
  };
}

export type WeeklyConversion = {
  weekStart: string;
  total: number;
  converted: number;
  unconverted: number;
  pending: number;
  unknown: number;
  percentage: number | null;
  aiCost: AiCostSummary;
};

export function calendarWeekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${monday}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

export function shiftCalendarWeek(monday: string, weeks: number): string {
  const date = new Date(`${monday}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return date.toISOString().slice(0, 10);
}

/** Calendar weeks include Saturday and Sunday in the preceding Monday's week. */
export function messageWeek(value: unknown, now: Date = new Date()): string {
  let day = copenhagenDate(now);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T12:00:00Z`);
    if (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value) day = value;
  }
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

export function weeklyConversion(
  weekStart: string,
  counts: Partial<
    Pick<WeeklyConversion, 'total' | 'converted' | 'unconverted' | 'pending' | 'unknown'>
  > = {},
  aiCost: AiCostSummary = emptyAiCost()
): WeeklyConversion {
  const total = Number(counts.total ?? 0);
  const converted = Number(counts.converted ?? 0);
  return {
    weekStart,
    total,
    converted,
    unconverted: Number(counts.unconverted ?? 0),
    pending: Number(counts.pending ?? 0),
    unknown: Number(counts.unknown ?? 0),
    percentage: total === 0 ? null : Math.round((converted / total) * 1000) / 10,
    aiCost,
  };
}
