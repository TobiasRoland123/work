import type { Granularity } from '@/lib/employee-stats/history';

export const PERSONAL_STATS_PERIODS = [7, 30, 90, 180, 365] as const;
export type PersonalStatsRange = (typeof PERSONAL_STATS_PERIODS)[number];
export type ComparisonReason = 'off' | 'small-cohort' | 'low-coverage' | 'no-working-days' | null;

export type AttendanceTotals = {
  office: number;
  remote: number;
  client: number;
  away: number;
  /** No applicable classified declaration. Excludes assumed defaults. */
  unknown: number;
  /** Synthetic Workday Default, excluded from recorded attendance. */
  assumed: number;
  eligible: number;
  recorded: number;
  working: number;
  /** Ratios are between zero and one; null when the denominator is zero. */
  officeShare: number | null;
  coverage: number | null;
};

export type PersonalStatsPoint = {
  key: string;
  label: string;
  title: string;
  startDate: string;
  endDate: string;
  totals: AttendanceTotals;
  companyShare: number | null;
  comparisonReason: ComparisonReason;
};

export type PersonalStats = {
  range: PersonalStatsRange;
  comparison: boolean;
  startDate: string;
  endDate: string;
  workdays: number;
  granularity: Granularity;
  totals: AttendanceTotals;
  series: PersonalStatsPoint[];
  /** Aggregate other employees only. Never includes individual colleague data. */
  company: { officeShare: number | null; comparisonReason: ComparisonReason };
  /** Recorded coverage cannot establish whether all Slack history was imported. */
  historyCompleteness: 'unverified';
  comparisonProvisional: true;
};
