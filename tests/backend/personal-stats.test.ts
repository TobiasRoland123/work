import { describe, expect, it } from 'vitest';
import type { Status, UserStatus } from '@/db/types';
import { calendarDays, startedWorkdays, trackedFrom } from '@/lib/employee-stats/stats';
import {
  companyComparison,
  weekdayPattern,
  personalStatsRange,
  resolveRecordedDays,
  summarizePersonalStats,
  tallyRecordedDays,
  type AttendanceDay,
} from '@/lib/personal-stats/stats';

const now = new Date('2026-09-25T10:00:00Z');
const workdays = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25'];
const declaration = (status: UserStatus | null, extra: Partial<Status> = {}): Status => ({
  id: 1,
  userID: 'self',
  status,
  details: null,
  emoji: null,
  fromDate: workdays[0]!,
  toDate: workdays.at(-1)!,
  startsAt: null,
  endsAt: null,
  startsAtApproximate: false,
  endsAtApproximate: false,
  sourceMessageKey: null,
  time: null,
  createdAt: '2026-09-20 12:00:00',
  announcedAt: new Date('2026-09-20T10:00:00Z'),
  ...extra,
});
const person = (...days: AttendanceDay[]) => ({ days });
const recordedWeek = person('office', 'office', 'remote', 'client', 'away');
const company = Array.from({ length: 4 }, () => recordedWeek);

describe('personal recorded attendance', () => {
  it.each(['7', '30', '90', '180', '365'])('accepts period %s', (value) => {
    expect(personalStatsRange(value)).toBe(Number(value));
  });

  it.each(['all', '-10', '1000000', undefined, ['7'], 7])('bounds invalid periods %s', (value) => {
    expect(personalStatsRange(value)).toBe(30);
  });

  it('keeps missing defaults, unclassified declarations and untracked days distinct', () => {
    const rows = [declaration(null, { fromDate: '2026-09-23', toDate: '2026-09-23' })];
    expect(resolveRecordedDays(rows, 'self', workdays, '2026-09-22', now)).toEqual([
      null,
      'assumed',
      'unknown',
      'assumed',
      'assumed',
    ]);
    const totals = tallyRecordedDays([
      person('office', 'remote', 'client', 'away', 'unknown', 'assumed', null),
    ]);
    expect(totals).toEqual({
      office: 1,
      remote: 1,
      client: 1,
      away: 1,
      unknown: 1,
      assumed: 1,
      eligible: 6,
      recorded: 4,
      working: 3,
      coverage: 4 / 6,
      officeShare: 1 / 3,
    });
  });

  it('never counts synthetic id zero as a recorded office declaration', () => {
    const days = resolveRecordedDays(
      [declaration('IN_OFFICE', { id: 0 })],
      'self',
      workdays,
      workdays[0]!,
      now
    );
    expect(tallyRecordedDays([{ days }])).toMatchObject({
      office: 0,
      assumed: 5,
      recorded: 0,
      coverage: 0,
      officeShare: null,
    });
  });

  it.each([
    ['IN_OFFICE', 'office'],
    ['IN_LATE', 'office'],
    ['LEAVING_EARLY', 'office'],
    ['FROM_HOME', 'remote'],
    ['REMOTE', 'remote'],
    ['AT_CLIENT', 'client'],
    ['SICK', 'away'],
    ['CHILD_SICK', 'away'],
    ['VACATION', 'away'],
    ['ON_LEAVE', 'away'],
    ['AWAY', 'away'],
  ] as const)('classifies recorded %s as %s', (status, expected) => {
    expect(resolveRecordedDays([declaration(status)], 'self', workdays, workdays[0]!, now)).toEqual(
      Array(5).fill(expected)
    );
  });

  it('resolves past days at 09:00 Copenhagen and today at the live clock', () => {
    const timed = declaration('FROM_HOME', { startsAt: new Date('2026-09-21T08:00:00Z') });
    expect(resolveRecordedDays([timed], 'self', workdays, workdays[0]!, now)).toEqual([
      'unknown',
      'remote',
      'remote',
      'remote',
      'remote',
    ]);
    const today = declaration('IN_LATE', {
      fromDate: '2026-09-25',
      toDate: '2026-09-25',
      time: new Date('2026-09-25T11:00:00Z'),
    });
    expect(resolveRecordedDays([today], 'self', ['2026-09-25'], '2026-09-25', now)).toEqual([
      'office',
    ]);
  });

  it('starts weekdays at 09:00 through daylight saving changes, excluding weekends', () => {
    const early = new Date('2026-10-26T07:59:00Z');
    expect(startedWorkdays(calendarDays(4, early), early)).toEqual(['2026-10-23']);
    const started = new Date('2026-10-26T08:00:00Z');
    expect(startedWorkdays(calendarDays(4, started), started)).toEqual([
      '2026-10-23',
      '2026-10-26',
    ]);
    expect(trackedFrom('2026-09-24 08:00:00', '2026-09-22')).toBe('2026-09-22');
    expect(resolveRecordedDays([], 'self', workdays, '2026-10-01', now)).toEqual(
      Array(5).fill(null)
    );
  });

  it('does not fabricate a zero share for absence-only or empty data', () => {
    expect(tallyRecordedDays([person('away')])).toMatchObject({ officeShare: null, coverage: 1 });
    expect(tallyRecordedDays([])).toMatchObject({ officeShare: null, coverage: null, eligible: 0 });
  });
});

describe('company comparison policy', () => {
  const own = tallyRecordedDays([recordedWeek]);

  it('pools recorded working days, excludes absences and permits exactly 80 percent coverage', () => {
    const colleagues = [
      person('office', 'remote', 'remote', 'remote', 'unknown'),
      ...Array.from({ length: 3 }, () => person('office', 'office', 'office', 'office', 'assumed')),
    ];
    expect(companyComparison(own, colleagues, true, 0, 5)).toEqual({
      officeShare: 13 / 16,
      comparisonReason: null,
    });
  });

  it('suppresses when comparison is off, fewer than four contribute, or either coverage is low', () => {
    expect(companyComparison(own, company, false, 0, 5).comparisonReason).toBe('off');
    expect(companyComparison(own, company.slice(0, 3), true, 0, 5).comparisonReason).toBe(
      'small-cohort'
    );
    expect(
      companyComparison(
        own,
        [...company.slice(0, 3), person('away', 'away', 'away', 'away', 'away')],
        true,
        0,
        5
      ).comparisonReason
    ).toBe('small-cohort');
    expect(
      companyComparison(tallyRecordedDays([person('office', 'assumed')]), company, true, 0, 5)
        .comparisonReason
    ).toBe('low-coverage');
    const sparse = Array.from({ length: 4 }, () =>
      person('office', 'unknown', 'unknown', 'unknown', 'unknown')
    );
    expect(companyComparison(own, sparse, true, 0, 5)).toEqual({
      officeShare: null,
      comparisonReason: 'low-coverage',
    });
    expect(companyComparison(tallyRecordedDays([person('away')]), company, true, 0, 5)).toEqual({
      officeShare: null,
      comparisonReason: 'no-working-days',
    });
  });

  it('uses the same bucket bounds for both sides and suppresses sparse buckets independently', () => {
    const others = Array.from({ length: 4 }, () =>
      person('office', 'office', 'office', 'office', 'unknown')
    );
    const result = summarizePersonalStats({
      range: 7,
      comparison: true,
      startDate: workdays[0]!,
      endDate: workdays.at(-1)!,
      workdays,
      own: recordedWeek,
      colleagues: others,
    });
    expect(result.company.officeShare).toBe(1);
    expect(result.series[0]?.companyShare).toBe(1);
    expect(result.series.at(-1)).toMatchObject({
      companyShare: null,
      comparisonReason: 'small-cohort',
    });
    expect(result).toMatchObject({
      historyCompleteness: 'unverified',
      comparisonProvisional: true,
    });
  });

  it('excludes prejoin days from the company denominator', () => {
    const others = Array.from({ length: 4 }, () => person(null, null, null, null, 'office'));
    expect(companyComparison(own, others, true, 0, 5)).toEqual({
      officeShare: 1,
      comparisonReason: null,
    });
  });
});

describe('personal weekday pattern', () => {
  const dates = ['2026-09-21', '2026-09-23', '2026-09-28'];

  it('groups Monday through Friday by date and pools day counts rather than percentages', () => {
    const own = person('office', 'remote', 'remote');
    const others = [
      person('office', 'remote', 'remote'),
      ...Array.from({ length: 3 }, () => person('office', 'office', null)),
    ];
    const result = weekdayPattern(dates, own, others, true);
    expect(result.map(({ label }) => label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    expect(result[0]).toMatchObject({
      weekday: 1,
      totals: { office: 1, working: 2, officeShare: 0.5 },
      companyShare: 4 / 5,
      comparisonReason: null,
    });
    expect(result[2]).toMatchObject({
      weekday: 3,
      totals: { office: 0, working: 1, officeShare: 0 },
      companyShare: 3 / 4,
    });
    expect(result[1]).toMatchObject({
      totals: { eligible: 0, officeShare: null },
      companyShare: null,
    });
  });

  it('applies coverage and minimum contributors independently to each weekday', () => {
    const own = person('office', 'office', 'unknown');
    const others = Array.from({ length: 4 }, (_, index) =>
      person('office', index === 3 ? 'away' : 'office', 'office')
    );
    const result = weekdayPattern(dates, own, others, true);
    expect(result[0]).toMatchObject({
      totals: { coverage: 0.5, officeShare: 1 },
      companyShare: null,
      comparisonReason: 'low-coverage',
    });
    expect(result[2]).toMatchObject({ companyShare: null, comparisonReason: 'small-cohort' });
    const sparse = weekdayPattern(
      dates,
      person('office', 'office', 'office'),
      Array.from({ length: 4 }, () => person('office', 'office', 'assumed')),
      true
    );
    expect(sparse[0]).toMatchObject({ companyShare: null, comparisonReason: 'low-coverage' });
    expect(sparse[2]).toMatchObject({ companyShare: 1, comparisonReason: null });
  });

  it('keeps absence-only and empty weekdays unavailable instead of assigning zero', () => {
    const result = weekdayPattern(
      dates,
      person('away', null, 'away'),
      Array.from({ length: 4 }, () => person('office', 'office', 'office')),
      true
    );
    expect(result[0]).toMatchObject({
      totals: { officeShare: null, coverage: 1 },
      companyShare: null,
      comparisonReason: 'no-working-days',
    });
    expect(result[2]?.totals.eligible).toBe(0);
  });

  it('turns every weekday comparison off without removing personal counts', () => {
    const result = weekdayPattern(dates, person('office', 'remote', 'office'), company, false);
    expect(result.every((day) => day.companyShare === null && day.comparisonReason === 'off')).toBe(
      true
    );
    expect(result[0]?.totals.officeShare).toBe(1);
    expect(result[2]?.totals.officeShare).toBe(0);
  });
});
