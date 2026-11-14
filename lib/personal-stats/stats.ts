import type { Status, UserStatus } from '@/db/types';
import { bucketWorkdays } from '@/lib/employee-stats/history';
import { copenhagenDate, copenhagenWallClock, resolvePresenceStatus } from '@/lib/status/active';
import { PERSONAL_STATS_PERIODS } from './types';
import type {
  AttendanceTotals,
  ComparisonReason,
  PersonalStats,
  PersonalStatsRange,
} from './types';

export const MIN_COMPANY_CONTRIBUTORS = 4;
export const MIN_RECORDED_COVERAGE = 0.8;
export type AttendanceDay = 'office' | 'remote' | 'client' | 'away' | 'unknown' | 'assumed' | null;
export type RecordedPerson = { days: readonly AttendanceDay[] };

const groupOfStatus: Record<UserStatus, Exclude<AttendanceDay, 'unknown' | 'assumed' | null>> = {
  IN_OFFICE: 'office',
  IN_LATE: 'office',
  LEAVING_EARLY: 'office',
  FROM_HOME: 'remote',
  REMOTE: 'remote',
  AT_CLIENT: 'client',
  SICK: 'away',
  CHILD_SICK: 'away',
  VACATION: 'away',
  ON_LEAVE: 'away',
  AWAY: 'away',
};

export function personalStatsRange(value: unknown): PersonalStatsRange {
  const days = typeof value === 'string' ? Number(value) : NaN;
  return PERSONAL_STATS_PERIODS.find((period) => period === days) ?? 30;
}

/** A missing day remains assumed or unknown; it never becomes recorded office attendance. */
export function resolveRecordedDays(
  statuses: readonly Status[],
  userId: string,
  workdays: readonly string[],
  firstDay: string,
  now: Date
): AttendanceDay[] {
  const today = copenhagenDate(now);
  const actual = statuses.filter((row) => row.id !== 0);
  return workdays.map((day) => {
    if (day < firstDay) return null;
    const moment = day === today ? now : copenhagenWallClock(day, 9, 0);
    const resolved = resolvePresenceStatus(actual, userId, moment);
    if (resolved?.id === 0) return 'assumed';
    return resolved?.status ? groupOfStatus[resolved.status] : 'unknown';
  });
}

export function tallyRecordedDays(
  people: readonly RecordedPerson[],
  from = 0,
  to = people[0]?.days.length ?? 0
): AttendanceTotals {
  const totals: AttendanceTotals = {
    office: 0,
    remote: 0,
    client: 0,
    away: 0,
    unknown: 0,
    assumed: 0,
    eligible: 0,
    recorded: 0,
    working: 0,
    officeShare: null,
    coverage: null,
  };
  for (const { days } of people) {
    for (let index = from; index < to; index += 1) {
      const day = days[index];
      if (day == null) continue;
      totals[day] += 1;
      totals.eligible += 1;
    }
  }
  totals.working = totals.office + totals.remote + totals.client;
  totals.recorded = totals.working + totals.away;
  totals.officeShare = totals.working ? totals.office / totals.working : null;
  totals.coverage = totals.eligible ? totals.recorded / totals.eligible : null;
  return totals;
}

/** Suppression applies independently to the whole period and each chart bucket. */
export function companyComparison(
  own: AttendanceTotals,
  colleagues: readonly RecordedPerson[],
  comparison: boolean,
  from: number,
  to: number
): { officeShare: number | null; comparisonReason: ComparisonReason } {
  const hidden = (comparisonReason: ComparisonReason) => ({ officeShare: null, comparisonReason });
  if (!comparison) return hidden('off');
  const totals = tallyRecordedDays(colleagues, from, to);
  const contributors = colleagues.filter(
    (person) => tallyRecordedDays([person], from, to).working > 0
  ).length;
  if (contributors < MIN_COMPANY_CONTRIBUTORS) return hidden('small-cohort');
  if (
    own.coverage === null ||
    own.coverage < MIN_RECORDED_COVERAGE ||
    totals.coverage === null ||
    totals.coverage < MIN_RECORDED_COVERAGE
  )
    return hidden('low-coverage');
  if (!own.working || !totals.working) return hidden('no-working-days');
  return { officeShare: totals.officeShare, comparisonReason: null };
}

/** Inputs contain no display identities; the result exposes only the subject and aggregates. */
export function summarizePersonalStats(input: {
  range: PersonalStatsRange;
  comparison: boolean;
  startDate: string;
  endDate: string;
  workdays: readonly string[];
  own: RecordedPerson;
  colleagues: readonly RecordedPerson[];
}): PersonalStats {
  const { range, comparison, startDate, endDate, workdays, own, colleagues } = input;
  const { granularity, buckets } = bucketWorkdays(workdays);
  const totals = tallyRecordedDays([own]);
  return {
    range,
    comparison,
    startDate,
    endDate,
    workdays: workdays.length,
    granularity,
    totals,
    series: buckets.map((bucket) => {
      const totals = tallyRecordedDays([own], bucket.from, bucket.to);
      const company = companyComparison(totals, colleagues, comparison, bucket.from, bucket.to);
      return {
        key: bucket.key,
        label: bucket.label,
        title: bucket.title,
        startDate: workdays[bucket.from]!,
        endDate: workdays[bucket.to - 1]!,
        totals,
        companyShare: company.officeShare,
        comparisonReason: company.comparisonReason,
      };
    }),
    company: companyComparison(totals, colleagues, comparison, 0, workdays.length),
    historyCompleteness: 'unverified',
    comparisonProvisional: true,
  };
}
