import { addDays, formatDay } from '@/lib/status/week';
import {
  UNTRACKED_CODE,
  absenceDays,
  emptyGroupCounts,
  mergeDays,
  officeShare,
  personDays,
  tallyCodes,
  weekdayOf,
  weekdayStats,
} from './stats';
import type { EmployeeDays, PersonDays, WeekdayStats } from './stats';
import { share } from './format';

export type Granularity = 'day' | 'week' | 'month';

/** A run of consecutive workdays that is charted as one point. */
export type Bucket = {
  key: string;
  /** Short axis label. */
  label: string;
  /** Longer label for tooltips and screen readers. */
  title: string;
  /** Index range into the workdays the buckets were made for; `to` is exclusive. */
  from: number;
  to: number;
};

const MAX_DAILY_SPAN = 14;
const MAX_WEEKLY_SPAN = 400;

/**
 * Group workdays into days, weeks or months, whichever keeps a chart readable for the span: a
 * fortnight or less by day, up to about 13 months by week, longer by month. Weeks start on Monday
 * and the first and last bucket may be partial, so charts compare shares rather than totals.
 */
export function bucketWorkdays(workdays: readonly string[]): {
  granularity: Granularity;
  buckets: Bucket[];
} {
  if (workdays.length === 0) return { granularity: 'week', buckets: [] };
  const first = workdays[0]!;
  const last = workdays.at(-1)!;
  const span =
    Math.round((Date.parse(`${last}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 864e5) + 1;
  const granularity: Granularity =
    span <= MAX_DAILY_SPAN ? 'day' : span <= MAX_WEEKLY_SPAN ? 'week' : 'month';

  const keyOf = (day: string) =>
    granularity === 'day'
      ? day
      : granularity === 'week'
        ? addDays(day, 1 - weekdayOf(day))
        : day.slice(0, 7);
  const labelOf = (key: string, day: string) =>
    granularity === 'day'
      ? formatDay(day, { weekday: 'short', day: 'numeric' })
      : granularity === 'week'
        ? formatDay(key, { day: 'numeric', month: 'short' })
        : formatDay(day, { month: 'short', year: '2-digit' });
  const titleOf = (key: string, day: string) =>
    granularity === 'day'
      ? formatDay(day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : granularity === 'week'
        ? `Week of ${formatDay(key, { day: 'numeric', month: 'long', year: 'numeric' })}`
        : formatDay(day, { month: 'long', year: 'numeric' });

  const buckets: Bucket[] = [];
  workdays.forEach((day, index) => {
    const key = keyOf(day);
    const current = buckets.at(-1);
    if (current?.key === key) current.to = index + 1;
    else
      buckets.push({
        key,
        label: labelOf(key, day),
        title: titleOf(key, day),
        from: index,
        to: index + 1,
      });
  });
  return { granularity, buckets };
}

export type SeriesPoint = EmployeeDays & { bucket: Bucket };

/** Attendance per bucket for the given people together. */
export function seriesFor(
  people: readonly { codes: ArrayLike<number> }[],
  buckets: readonly Bucket[]
): SeriesPoint[] {
  return buckets.map((bucket) => {
    const point: EmployeeDays = { counts: emptyGroupCounts(), noStatus: 0 };
    for (const { codes } of people) mergeDays(point, tallyCodes(codes, bucket.from, bucket.to));
    return { ...point, bucket };
  });
}

/** The range most people fall inside: the 25th to the 75th percentile. */
export type Spread = { low: number; high: number };

/** The least colleagues needed before a spread says anything. */
export const MIN_SPREAD_PEOPLE = 4;

/** A quantile of values sorted ascending, interpolated between neighbours. */
export function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const position = (sorted.length - 1) * q;
  const below = Math.floor(position);
  const above = Math.ceil(position);
  return sorted[below]! + (sorted[above]! - sorted[below]!) * (position - below);
}

/** How widely people's office share varies in each bucket; null where too few people worked. */
export function officeShareSpread(
  people: readonly { codes: ArrayLike<number> }[],
  buckets: readonly Bucket[]
): (Spread | null)[] {
  return buckets.map((bucket) => {
    const shares = people
      .map(({ codes }) => officeShare(tallyCodes(codes, bucket.from, bucket.to).counts))
      .filter((value): value is number => value !== null)
      .sort((a, b) => a - b);
    return shares.length < MIN_SPREAD_PEOPLE
      ? null
      : { low: quantile(shares, 0.25), high: quantile(shares, 0.75) };
  });
}

export type Side = {
  totals: EmployeeDays;
  series: SeriesPoint[];
  weekdays: WeekdayStats[];
};

export type NormSide = Side & {
  /** How many colleagues the norm is made of. */
  colleagues: number;
  spread: (Spread | null)[];
};

export type DayCell = { date: string; code: number };

/** The most weeks the calendar shows, so a long history stays legible. */
export const CALENDAR_WEEKS = 53;

export type EmployeeProfile = {
  workdays: string[];
  granularity: Granularity;
  buckets: Bucket[];
  person: Side;
  /** The colleagues over the same days; null when there is nobody to compare with. */
  norm: NormSide | null;
  /**
   * Share of colleagues whose office share is lower than this person's (ties count half); null
   * without enough colleagues to rank against.
   */
  officeRank: number | null;
  calendar: DayCell[];
};

/**
 * One person's attendance, and the norm: all of their colleagues over the same workdays. The
 * range starts on the person's first tracked day, so a recent joiner is not compared with a
 * history they were never part of.
 */
export function buildProfile(
  workdays: readonly string[],
  subject: PersonDays,
  colleagues: readonly PersonDays[]
): EmployeeProfile {
  let first = 0;
  while (first < workdays.length && subject.codes[first] === UNTRACKED_CODE) first += 1;

  const days = workdays.slice(first);
  const trim = <T extends { codes: ArrayLike<number> }>(person: T) => ({
    ...person,
    codes: Array.prototype.slice.call(person.codes, first) as number[],
  });
  const own = trim(subject);
  const others = colleagues.map(trim);
  const { granularity, buckets } = bucketWorkdays(days);

  const side = (people: readonly { codes: ArrayLike<number> }[]): Side => {
    const totals: EmployeeDays = { counts: emptyGroupCounts(), noStatus: 0 };
    for (const { codes } of people) mergeDays(totals, tallyCodes(codes, 0, days.length));
    return { totals, series: seriesFor(people, buckets), weekdays: weekdayStats(people, days) };
  };

  const ownShare = officeShare(tallyCodes(own.codes, 0, days.length).counts);
  const colleagueShares = others
    .map(({ codes }) => officeShare(tallyCodes(codes, 0, days.length).counts))
    .filter((value): value is number => value !== null);
  const officeRank =
    ownShare === null || colleagueShares.length < 3
      ? null
      : share(
          colleagueShares.filter((value) => value < ownShare).length +
            colleagueShares.filter((value) => value === ownShare).length / 2,
          colleagueShares.length
        );

  return {
    workdays: days,
    granularity,
    buckets,
    person: side([own]),
    norm:
      others.length === 0
        ? null
        : {
            ...side(others),
            colleagues: others.length,
            spread: officeShareSpread(others, buckets),
          },
    officeRank,
    calendar: days.slice(-CALENDAR_WEEKS * 5).map((date, index, shown) => ({
      date,
      code: own.codes[days.length - shown.length + index]!,
    })),
  };
}

/** Absence as a share of everything counted, shared by the overview and profile pages. */
export const absenceRate = (days: EmployeeDays): number | null =>
  share(absenceDays(days.counts), personDays(days));
