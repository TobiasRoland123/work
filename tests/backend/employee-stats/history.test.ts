import { describe, expect, it } from 'vitest';
import {
  CALENDAR_WEEKS,
  MIN_SPREAD_PEOPLE,
  absenceRate,
  bucketWorkdays,
  buildProfile,
  officeShareSpread,
  quantile,
  seriesFor,
} from '@/lib/employee-stats/history';
import {
  NO_STATUS_CODE,
  UNTRACKED_CODE,
  calendarSpan,
  officeShare,
  startedWorkdays,
  tallyCodes,
  type PersonDays,
} from '@/lib/employee-stats/stats';

const OFFICE = 0;
const REMOTE = 1;
const SICK = 3;
const VACATION = 4;

const now = new Date('2026-12-31T12:00:00Z');
const workdaysBetween = (start: string, end: string) =>
  startedWorkdays(calendarSpan(start, end), now);
const person = (userId: string, codes: number[]): PersonDays => ({
  userId,
  name: userId,
  email: `${userId}@example.com`,
  codes,
});
const repeat = (code: number, times: number) => Array<number>(times).fill(code);

describe('bucketing workdays', () => {
  it('uses days for up to a fortnight', () => {
    const { granularity, buckets } = bucketWorkdays(workdaysBetween('2026-09-21', '2026-09-30'));
    expect(granularity).toBe('day');
    expect(buckets).toHaveLength(8);
    expect(buckets[0]).toMatchObject({ from: 0, to: 1 });
  });

  it('uses weeks starting on Monday for a few months, with partial edges', () => {
    // Wed 23 Sep to Tue 6 Oct: 3 days, then a full week, then 2 days.
    const days = workdaysBetween('2026-09-23', '2026-10-13');
    const { granularity, buckets } = bucketWorkdays(days);
    expect(granularity).toBe('week');
    expect(buckets.map((bucket) => bucket.key)).toEqual([
      '2026-09-21',
      '2026-09-28',
      '2026-10-05',
      '2026-10-12',
    ]);
    expect(buckets.map((bucket) => bucket.to - bucket.from)).toEqual([3, 5, 5, 2]);
    expect(buckets[1]!.title).toBe('Week of 28 September 2026');
  });

  it('uses months once the span is longer than about 13 months', () => {
    const days = workdaysBetween('2025-01-01', '2026-09-30');
    const { granularity, buckets } = bucketWorkdays(days);
    expect(granularity).toBe('month');
    expect(buckets).toHaveLength(21);
    expect(buckets[0]).toMatchObject({ key: '2025-01', label: 'Jan 25', title: 'January 2025' });
  });

  it('covers every workday exactly once, whatever the granularity', () => {
    for (const [start, end] of [
      ['2026-09-21', '2026-09-30'],
      ['2026-03-02', '2026-10-30'],
      ['2024-06-12', '2026-10-30'],
    ] as const) {
      const days = workdaysBetween(start, end);
      const { buckets } = bucketWorkdays(days);
      expect(buckets[0]!.from).toBe(0);
      expect(buckets.at(-1)!.to).toBe(days.length);
      buckets.slice(1).forEach((bucket, index) => expect(bucket.from).toBe(buckets[index]!.to));
    }
  });

  it('has no buckets without workdays', () => {
    expect(bucketWorkdays([]).buckets).toEqual([]);
  });
});

describe('series and spread', () => {
  const days = workdaysBetween('2026-09-21', '2026-10-09'); // three full weeks
  const { buckets } = bucketWorkdays(days);

  it('adds up several people per bucket and skips untracked days', () => {
    const people = [
      person('a', [...repeat(OFFICE, 5), ...repeat(REMOTE, 5), ...repeat(SICK, 5)]),
      person('b', [...repeat(UNTRACKED_CODE, 5), ...repeat(OFFICE, 5), ...repeat(OFFICE, 5)]),
    ];
    const series = seriesFor(people, buckets);
    expect(series.map((point) => point.counts.office)).toEqual([5, 5, 5]);
    expect(series.map((point) => point.counts.remote)).toEqual([0, 5, 0]);
    expect(series.map((point) => point.counts.sick)).toEqual([0, 0, 5]);
  });

  it('interpolates quantiles', () => {
    expect(quantile([0, 10], 0.5)).toBe(5);
    expect(quantile([1, 2, 3, 4, 5], 0.25)).toBe(2);
    expect(quantile([1, 2, 3, 4, 5], 0.75)).toBe(4);
    expect(quantile([7], 0.9)).toBe(7);
    expect(quantile([], 0.5)).toBeNaN();
  });

  it('gives the middle half of office shares, and nothing for too few people', () => {
    const shares = [0, 2, 4, 5].map((office) =>
      person(`p${office}`, [
        ...repeat(OFFICE, office),
        ...repeat(REMOTE, 5 - office),
        ...repeat(OFFICE, 10),
      ])
    );
    expect(shares).toHaveLength(MIN_SPREAD_PEOPLE);
    const [first] = officeShareSpread(shares, buckets);
    expect(first!.low).toBeCloseTo(0.4 * 0.75, 5);
    expect(first!.high).toBeCloseTo(0.85, 5);
    expect(officeShareSpread(shares.slice(1), buckets)[0]).toBeNull();
  });

  it('leaves out people with no working days in a bucket', () => {
    const away = [0, 1, 2, 3].map((index) => person(`p${index}`, repeat(VACATION, 15)));
    expect(officeShareSpread(away, buckets).every((spread) => spread === null)).toBe(true);
  });
});

describe('building a profile', () => {
  const days = workdaysBetween('2026-09-21', '2026-10-16'); // four weeks, 20 days
  const colleagues = [
    person('c1', repeat(OFFICE, 20)),
    person('c2', [...repeat(OFFICE, 10), ...repeat(REMOTE, 10)]),
    person('c3', [...repeat(REMOTE, 10), ...repeat(OFFICE, 10)]),
    person('c4', repeat(REMOTE, 20)),
  ];

  it('compares a person with the other employees over the same days', () => {
    const subject = person('me', [...repeat(OFFICE, 15), ...repeat(SICK, 5)]);
    const profile = buildProfile(days, subject, colleagues);

    expect(profile.workdays).toEqual(days);
    expect(profile.person.totals.counts).toMatchObject({ office: 15, sick: 5 });
    expect(profile.norm?.colleagues).toBe(4);
    expect(profile.norm?.totals.counts).toMatchObject({ office: 40, remote: 40 });
    expect(officeShare(profile.norm!.totals.counts)).toBe(0.5);
    expect(profile.norm?.series).toHaveLength(profile.buckets.length);
    expect(profile.person.weekdays.map((weekday) => weekday.days)).toEqual([4, 4, 4, 4, 4]);
  });

  it('never folds the person into their own norm', () => {
    const subject = person('me', repeat(SICK, 20));
    const profile = buildProfile(days, subject, colleagues);
    expect(profile.norm?.totals.counts.sick).toBe(0);
    expect(absenceRate(profile.norm!.totals)).toBe(0);
    expect(absenceRate(profile.person.totals)).toBe(1);
  });

  it('has no norm when asked for the individual alone, or with no colleagues', () => {
    const subject = person('me', repeat(OFFICE, 20));
    expect(buildProfile(days, subject, []).norm).toBeNull();
    expect(buildProfile(days, subject, []).officeRank).toBeNull();
  });

  it('ranks the office share against colleagues, counting ties as half', () => {
    const full = buildProfile(days, person('me', repeat(OFFICE, 20)), colleagues);
    // c1 ties with 100%; the other three are lower: (3 + 0.5) / 4.
    expect(full.officeRank).toBe(0.875);
    const none = buildProfile(days, person('me', repeat(REMOTE, 20)), colleagues);
    // c4 ties at 0%; nobody is lower.
    expect(none.officeRank).toBe(0.125);
  });

  it('does not rank without enough colleagues or without working days', () => {
    expect(
      buildProfile(days, person('me', repeat(OFFICE, 20)), colleagues.slice(0, 2)).officeRank
    ).toBeNull();
    expect(
      buildProfile(days, person('me', repeat(VACATION, 20)), colleagues).officeRank
    ).toBeNull();
  });

  it('starts at the person’s first tracked day and compares over those days only', () => {
    const subject = person('new', [...repeat(UNTRACKED_CODE, 10), ...repeat(OFFICE, 10)]);
    const profile = buildProfile(days, subject, colleagues);
    expect(profile.workdays).toEqual(days.slice(10));
    expect(profile.person.totals.counts.office).toBe(10);
    // The norm covers the same ten days: c1 office, c2 remote, c3 office, c4 remote.
    expect(profile.norm?.totals.counts).toMatchObject({ office: 20, remote: 20 });
  });

  it('keeps colleagues who joined later out of the days before they were on record', () => {
    const late = person('late', [...repeat(UNTRACKED_CODE, 15), ...repeat(OFFICE, 5)]);
    const profile = buildProfile(days, person('me', repeat(OFFICE, 20)), [colleagues[0]!, late]);
    expect(profile.norm?.totals.counts.office).toBe(25);
  });

  it('is empty for someone with no tracked days', () => {
    const profile = buildProfile(days, person('ghost', repeat(UNTRACKED_CODE, 20)), colleagues);
    expect(profile.workdays).toEqual([]);
    expect(profile.buckets).toEqual([]);
    expect(profile.calendar).toEqual([]);
  });

  it('lists the person’s days for the calendar, capped at the latest weeks', () => {
    const long = workdaysBetween('2024-01-01', '2026-10-16');
    const codes = long.map((_, index) => (index % 7 === 0 ? NO_STATUS_CODE : OFFICE));
    const profile = buildProfile(long, person('me', codes), []);
    expect(profile.calendar).toHaveLength(CALENDAR_WEEKS * 5);
    expect(profile.calendar.at(-1)).toEqual({ date: long.at(-1), code: codes.at(-1) });
    expect(profile.calendar[0]!.date).toBe(long[long.length - CALENDAR_WEEKS * 5]);
    expect(profile.calendar.map((cell) => cell.code)).toEqual(codes.slice(-CALENDAR_WEEKS * 5));
  });

  it('adds up to the same totals as tallying the person directly', () => {
    const codes = days.map(
      (_, index) => [OFFICE, REMOTE, SICK, VACATION, NO_STATUS_CODE][index % 5]!
    );
    const profile = buildProfile(days, person('me', codes), colleagues);
    expect(profile.person.totals).toEqual(tallyCodes(codes));
    const summed = profile.person.series.reduce((total, point) => total + point.counts.office, 0);
    expect(summed).toBe(profile.person.totals.counts.office);
  });
});
