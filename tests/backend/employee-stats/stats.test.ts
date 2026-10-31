import { describe, expect, it } from 'vitest';
import type { DayPresence, Status, UserStatus } from '@/db/types';
import {
  NO_STATUS_CODE,
  UNTRACKED_CODE,
  absenceDays,
  calendarDays,
  calendarSpan,
  codeOfPresence,
  copenhagenDayOf,
  employeeSort,
  employeeStatsRange,
  officeShare,
  resolveEmployeeCodes,
  sortEmployees,
  startedWorkdays,
  summarizeEmployeeStats,
  tallyCodes,
  tallyDays,
  trackedFrom,
  workdaysInPeriod,
  workingDays,
  type EmployeeRow,
} from '@/lib/employee-stats/stats';
import { resolveWorkWeek } from '@/lib/status/week';
import { average, percent, pointGap, share } from '@/lib/employee-stats/format';

const status = (value: UserStatus): Status =>
  ({ id: 1, userID: 'person', status: value }) as unknown as Status;
const day = (date: string, value: UserStatus | null): DayPresence => ({
  date,
  status: value ? status(value) : null,
});
const person = (name: string, week: DayPresence[]) => ({
  userId: name.toLowerCase(),
  name,
  email: `${name.toLowerCase()}@example.com`,
  codes: Int8Array.from(week.map(codeOfPresence)),
});

describe('period and sort parsing', () => {
  it('accepts only the offered periods, or all time, and falls back to 30 days', () => {
    expect(employeeStatsRange('7')).toBe(7);
    expect(employeeStatsRange('90')).toBe(90);
    expect(employeeStatsRange('180')).toBe(180);
    expect(employeeStatsRange('365')).toBe(365);
    expect(employeeStatsRange('all')).toBe('all');
    expect(employeeStatsRange('366')).toBe(30);
    expect(employeeStatsRange('ALL')).toBe(30);
    expect(employeeStatsRange(['7'])).toBe(30);
    expect(employeeStatsRange(undefined)).toBe(30);
  });

  it('accepts only known sorts and falls back to name', () => {
    expect(employeeSort('office')).toBe('office');
    expect(employeeSort('vacation')).toBe('vacation');
    expect(employeeSort('email; drop table users')).toBe('name');
    expect(employeeSort(undefined)).toBe('name');
  });
});

describe('workdays in a period', () => {
  // Wednesday 2026-09-23, 12:00 in Copenhagen (CEST).
  const afternoon = new Date('2026-09-23T10:00:00Z');

  it('lists the calendar days ending today, oldest first', () => {
    expect(calendarDays(3, afternoon)).toEqual(['2026-09-21', '2026-09-22', '2026-09-23']);
  });

  it('skips weekends and counts today once it is past 09:00 in Copenhagen', () => {
    expect(workdaysInPeriod(10, afternoon)).toEqual([
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
    ]);
  });

  it('does not count this morning before 09:00 Copenhagen time', () => {
    const early = new Date('2026-09-23T06:59:00Z');
    expect(workdaysInPeriod(2, early)).toEqual(['2026-09-22']);
    expect(workdaysInPeriod(2, new Date('2026-09-23T07:00:00Z'))).toEqual([
      '2026-09-22',
      '2026-09-23',
    ]);
  });

  it('never counts the weekend itself, only the Friday before it', () => {
    const saturday = new Date('2026-09-26T10:00:00Z');
    expect(workdaysInPeriod(1, saturday)).toEqual([]);
    expect(workdaysInPeriod(2, saturday)).toEqual(['2026-09-25']);
    expect(workdaysInPeriod(3, saturday)).toEqual(['2026-09-24', '2026-09-25']);
  });
});

describe('tallying days', () => {
  const week = [
    day('2026-09-21', 'IN_OFFICE'),
    day('2026-09-22', 'IN_LATE'),
    day('2026-09-23', 'LEAVING_EARLY'),
    day('2026-09-24', 'FROM_HOME'),
    day('2026-09-25', 'REMOTE'),
    day('2026-09-28', 'AT_CLIENT'),
    day('2026-09-29', 'SICK'),
    day('2026-09-30', 'CHILD_SICK'),
    day('2026-10-01', 'VACATION'),
    day('2026-10-02', 'ON_LEAVE'),
    day('2026-10-05', 'AWAY'),
    day('2026-10-06', null),
  ];

  it('groups every attendance status and keeps days without a status apart', () => {
    const { counts, noStatus } = tallyDays(week);
    expect(counts).toEqual({ office: 3, remote: 2, client: 1, sick: 2, vacation: 1, other: 2 });
    expect(noStatus).toBe(1);
    expect(workingDays(counts)).toBe(6);
    expect(absenceDays(counts)).toBe(5);
  });

  it('counts a status without a group as no status', () => {
    expect(
      tallyDays([{ date: '2026-09-21', status: status('NOT_A_STATUS' as UserStatus) }])
    ).toMatchObject({
      noStatus: 1,
    });
  });

  it('computes the office share over working days, ignoring absences', () => {
    expect(officeShare(tallyDays(week).counts)).toBe(0.5);
    expect(officeShare(tallyDays([day('2026-09-21', 'VACATION')]).counts)).toBeNull();
    expect(officeShare(tallyDays([]).counts)).toBeNull();
  });
});

describe('formatting', () => {
  it('shows N/A rather than dividing by zero', () => {
    expect(percent(null)).toBe('N/A');
    expect(percent(0.5)).toBe('50%');
    expect(share(1, 0)).toBeNull();
    expect(share(1, 4)).toBe(0.25);
    expect(average(0, 0)).toBe('N/A');
    expect(average(7, 2)).toBe('3.5');
  });
});

describe('summarizing employees', () => {
  const days = ['2026-09-21', '2026-09-22', '2026-09-28'];
  const people = [
    person('Mads', [
      day('2026-09-21', 'IN_OFFICE'),
      day('2026-09-22', 'FROM_HOME'),
      day('2026-09-28', 'IN_OFFICE'),
    ]),
    person('anna', [
      day('2026-09-21', 'VACATION'),
      day('2026-09-22', 'VACATION'),
      day('2026-09-28', null),
    ]),
    person('Freja', [
      day('2026-09-21', 'IN_OFFICE'),
      day('2026-09-22', 'IN_OFFICE'),
      day('2026-09-28', 'SICK'),
    ]),
  ];

  it('adds up the company and each weekday', () => {
    const stats = summarizeEmployeeStats(people, days);
    expect(stats.totals.counts).toEqual({
      office: 4,
      remote: 1,
      client: 0,
      sick: 1,
      vacation: 2,
      other: 0,
    });
    expect(stats.totals.noStatus).toBe(1);
    expect(stats.weekdays.map((weekday) => weekday.days)).toEqual([2, 1, 0, 0, 0]);
    expect(stats.weekdays[0]?.counts).toMatchObject({ office: 3, vacation: 1, sick: 1 });
    expect(stats.weekdays[1]?.counts).toMatchObject({ office: 1, remote: 1, vacation: 1 });
  });

  it('sorts by name regardless of case, or by a group with the highest first', () => {
    expect(summarizeEmployeeStats(people, days).employees.map((row) => row.name)).toEqual([
      'anna',
      'Freja',
      'Mads',
    ]);
    expect(summarizeEmployeeStats(people, days, 'office').employees.map((row) => row.name)).toEqual(
      ['Freja', 'Mads', 'anna']
    );
  });

  it('leaves the resolved days out of the employee rows', () => {
    expect(summarizeEmployeeStats(people, days).employees[0]).not.toHaveProperty('codes');
  });

  it('handles a period with no people or workdays', () => {
    const stats = summarizeEmployeeStats([], []);
    expect(stats.employees).toEqual([]);
    expect(stats.totals.noStatus).toBe(0);
    expect(stats.weekdays.every((weekday) => weekday.days === 0)).toBe(true);
  });

  it('breaks ties by name and then id so the order is stable', () => {
    const row = (userId: string, name: string): EmployeeRow => ({
      userId,
      name,
      email: '',
      ...tallyDays([]),
    });
    expect(
      sortEmployees([row('b', 'Sam'), row('a', 'Sam'), row('c', 'Al')], 'sick').map((r) => r.userId)
    ).toEqual(['c', 'a', 'b']);
  });
});

describe('resolving each employee’s days', () => {
  // A small deterministic generator, so a failure can be reproduced.
  const random = (seed: number) => () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const kinds: UserStatus[] = [
    'IN_OFFICE',
    'IN_LATE',
    'LEAVING_EARLY',
    'FROM_HOME',
    'REMOTE',
    'AT_CLIENT',
    'SICK',
    'CHILD_SICK',
    'VACATION',
    'ON_LEAVE',
    'AWAY',
  ];

  function generate(seed: number): Status[] {
    const next = random(seed);
    const pick = <T>(values: readonly T[]) => values[Math.floor(next() * values.length)]!;
    const date = () => `2026-09-${String(14 + Math.floor(next() * 14)).padStart(2, '0')}`;
    const instantOn = (value: string) =>
      new Date(`${value}T${pick(['00:30', '06:00', '08:59', '12:00', '16:00', '21:59'])}:00Z`);
    return Array.from({ length: 12 }, (_, index) => {
      const from = next() < 0.2 ? null : date();
      const to = next() < 0.2 || !from ? null : pick([from, date()]);
      const announced = new Date(
        `2026-09-${String(10 + Math.floor(next() * 18)).padStart(2, '0')}T08:00:00Z`
      );
      return {
        id: index + 1,
        userID: 'person',
        status: pick(kinds),
        emoji: null,
        details: null,
        // Instants may fall on another day than the status's dates.
        time: next() < 0.3 ? instantOn(date()) : null,
        fromDate: from,
        toDate: to,
        startsAt: next() < 0.3 ? instantOn(date()) : null,
        endsAt: next() < 0.3 ? instantOn(date()) : null,
        startsAtApproximate: next() < 0.1,
        endsAtApproximate: next() < 0.1,
        sourceMessageKey: next() < 0.5 ? `message-${Math.floor(next() * 3)}` : null,
        announcedAt: next() < 0.1 ? null : announced,
        createdAt: '2026-09-10 10:00:00',
      } as unknown as Status;
    });
  }

  const codesOf = (statuses: Status[], workdays: string[], now: Date, firstDay = '2000-01-01') =>
    Array.from(resolveEmployeeCodes(statuses, 'person', workdays, firstDay, now));
  const reference = (statuses: Status[], workdays: string[], now: Date) =>
    resolveWorkWeek(statuses, 'person', workdays, now).map(codeOfPresence);

  it('matches resolving the whole period at once, for many kinds of declarations', () => {
    const nows = [
      new Date('2026-09-25T10:00:00Z'),
      new Date('2026-09-25T06:00:00Z'),
      new Date('2026-09-20T12:00:00Z'),
      new Date('2026-09-28T23:30:00Z'),
    ];
    for (let seed = 1; seed <= 150; seed += 1) {
      const statuses = generate(seed);
      for (const now of nows) {
        const workdays = workdaysInPeriod(14, now);
        expect(codesOf(statuses, workdays, now), `seed ${seed}`).toEqual(
          reference(statuses, workdays, now)
        );
      }
    }
  });

  it('matches over a long history, where most days have nothing declared', () => {
    const now = new Date('2026-09-25T10:00:00Z');
    const workdays = startedWorkdays(calendarSpan('2025-09-01', '2026-09-25'), now);
    for (let seed = 200; seed < 230; seed += 1) {
      const statuses = generate(seed);
      expect(codesOf(statuses, workdays, now), `seed ${seed}`).toEqual(
        reference(statuses, workdays, now)
      );
    }
  });

  it('treats an open-ended declaration as covering every later day', () => {
    const now = new Date('2026-09-25T10:00:00Z');
    const statuses = [
      { ...generate(1)[0]!, status: 'FROM_HOME', fromDate: '2026-09-10', toDate: null },
    ] as Status[];
    const workdays = workdaysInPeriod(30, now);
    expect(codesOf(statuses, workdays, now)).toEqual(reference(statuses, workdays, now));
  });

  it('still counts a declaration whose clock times fall on a day outside its dates', () => {
    const statuses = [
      {
        ...generate(1)[0]!,
        status: 'FROM_HOME',
        fromDate: '2026-09-21',
        toDate: '2026-09-21',
        startsAt: new Date('2026-09-22T06:00:00Z'),
        endsAt: null,
      },
    ] as Status[];
    const now = new Date('2026-09-25T10:00:00Z');
    const workdays = ['2026-09-21', '2026-09-22', '2026-09-23'];
    expect(codesOf(statuses, workdays, now)).toEqual(reference(statuses, workdays, now));
  });

  it('gives a person with no declarations the workday default', () => {
    const now = new Date('2026-09-25T10:00:00Z');
    expect(codesOf([], ['2026-09-24', '2026-09-25'], now)).toEqual([0, 0]);
  });

  it('leaves the days before a person was on record untracked', () => {
    const now = new Date('2026-09-25T10:00:00Z');
    const workdays = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24'];
    const statuses = [
      { ...generate(1)[0]!, status: 'SICK', fromDate: '2026-09-21', toDate: '2026-09-22' },
    ] as Status[];
    expect(codesOf(statuses, workdays, now, '2026-09-23')).toEqual([
      UNTRACKED_CODE,
      UNTRACKED_CODE,
      0,
      0,
    ]);
    expect(codesOf(statuses, workdays, now, '2026-10-01')).toEqual(Array(4).fill(UNTRACKED_CODE));
    // Counting starts on the first day, not before it, even for a declaration that began earlier.
    expect(tallyCodes(codesOf(statuses, workdays, now, '2026-09-22')).counts.sick).toBe(1);
  });

  it('tallies only untracked-free days and keeps days without a status apart', () => {
    const tally = tallyCodes([UNTRACKED_CODE, 0, 0, NO_STATUS_CODE, 3]);
    expect(tally.counts).toMatchObject({ office: 2, sick: 1 });
    expect(tally.noStatus).toBe(1);
    expect(tallyCodes([0, 0, 3, 3], 1, 3).counts).toMatchObject({ office: 1, sick: 1 });
  });
});

describe('where a person’s record starts', () => {
  it('reads database timestamps as UTC and returns the Copenhagen day', () => {
    expect(copenhagenDayOf('2026-03-10 08:00:00')).toBe('2026-03-10');
    expect(copenhagenDayOf('2026-03-10 23:30:00.123')).toBe('2026-03-11');
    expect(copenhagenDayOf('2026-03-10T08:00:00Z')).toBe('2026-03-10');
    expect(copenhagenDayOf('2026-03-10 23:30:00+00')).toBe('2026-03-11');
    expect(copenhagenDayOf('2026-03-10 23:30:00+01')).toBe('2026-03-10');
    expect(copenhagenDayOf('2026-03-10 23:30:00-05:30')).toBe('2026-03-11');
  });

  it('starts on the earlier of joining and the first announcement', () => {
    expect(trackedFrom('2026-03-10 08:00:00', null)).toBe('2026-03-10');
    expect(trackedFrom('2026-03-10 08:00:00', '2026-02-01')).toBe('2026-02-01');
    expect(trackedFrom('2026-03-10 08:00:00', '2026-04-01')).toBe('2026-03-10');
  });

  it('spans calendar days inclusively', () => {
    expect(calendarSpan('2026-09-29', '2026-10-02')).toEqual([
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ]);
    expect(calendarSpan('2026-10-02', '2026-10-01')).toEqual([]);
  });
});

describe('formatting gaps', () => {
  it('describes the gap to the norm in percentage points', () => {
    expect(pointGap(0.62, 0.54)).toBe('+8 pts');
    expect(pointGap(0.5, 0.58)).toBe('−8 pts');
    expect(pointGap(0.5, 0.5)).toBe('same as the norm');
    expect(pointGap(null, 0.5)).toBeNull();
    expect(pointGap(0.5, null)).toBeNull();
  });
});
