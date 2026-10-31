import type { DayPresence, Status, UserStatus } from '@/db/types';
import { copenhagenDate, copenhagenWallClock, resolvePresenceStatus } from '@/lib/status/active';
import { addDays } from '@/lib/status/week';

export const EMPLOYEE_STATS_PERIODS = [7, 30, 90, 180, 365] as const;
/** A number of days back from today, or everything on record. */
export type EmployeeStatsRange = (typeof EMPLOYEE_STATS_PERIODS)[number] | 'all';
export const EMPLOYEE_STATS_RANGES: readonly EmployeeStatsRange[] = [
  ...EMPLOYEE_STATS_PERIODS,
  'all',
];
export const DEFAULT_EMPLOYEE_STATS_RANGE: EmployeeStatsRange = 30;
/** How far back "All time" reaches, so one stray date cannot make a page unbounded. */
export const MAX_HISTORY_DAYS = 1826;

/** Where a person was on a workday. Working days are the days in the office, at home or at a client. */
export const ATTENDANCE_GROUPS = [
  { key: 'office', label: 'In office', statuses: ['IN_OFFICE', 'IN_LATE', 'LEAVING_EARLY'] },
  { key: 'remote', label: 'Home & remote', statuses: ['FROM_HOME', 'REMOTE'] },
  { key: 'client', label: 'At client', statuses: ['AT_CLIENT'] },
  { key: 'sick', label: 'Sick', statuses: ['SICK', 'CHILD_SICK'] },
  { key: 'vacation', label: 'Vacation', statuses: ['VACATION'] },
  { key: 'other', label: 'Other absence', statuses: ['ON_LEAVE', 'AWAY'] },
] as const satisfies readonly { key: string; label: string; statuses: readonly UserStatus[] }[];

export type AttendanceGroupKey = (typeof ATTENDANCE_GROUPS)[number]['key'];
export type GroupCounts = Record<AttendanceGroupKey, number>;

export const GROUP_KEYS: readonly AttendanceGroupKey[] = ATTENDANCE_GROUPS.map(
  (group) => group.key
);

/**
 * A resolved workday as one small number: the index of its attendance group, `NO_STATUS_CODE`
 * for a day without an attendance status, or `UNTRACKED_CODE` before the person was on record.
 */
export const NO_STATUS_CODE = GROUP_KEYS.length;
export const UNTRACKED_CODE = -1;
export const OFFICE_CODE = GROUP_KEYS.indexOf('office');

const WORKING_GROUPS: readonly AttendanceGroupKey[] = ['office', 'remote', 'client'];

export const EMPLOYEE_SORTS = ['name', ...ATTENDANCE_GROUPS.map((group) => group.key)] as const;
export type EmployeeSort = (typeof EMPLOYEE_SORTS)[number];

const groupOfStatus = new Map<UserStatus, AttendanceGroupKey>(
  ATTENDANCE_GROUPS.flatMap((group) =>
    group.statuses.map((status): [UserStatus, AttendanceGroupKey] => [status, group.key])
  )
);

export function emptyGroupCounts(): GroupCounts {
  return { office: 0, remote: 0, client: 0, sick: 0, vacation: 0, other: 0 };
}

export function employeeStatsRange(value: unknown): EmployeeStatsRange {
  if (value === 'all') return 'all';
  const days = typeof value === 'string' ? Number(value) : NaN;
  return EMPLOYEE_STATS_PERIODS.find((period) => period === days) ?? DEFAULT_EMPLOYEE_STATS_RANGE;
}

export function employeeSort(value: unknown): EmployeeSort {
  return EMPLOYEE_SORTS.find((sort) => sort === value) ?? 'name';
}

/** The Copenhagen calendar days of a period ending today, oldest first. */
export function calendarDays(period: number, now: Date = new Date()): string[] {
  const today = copenhagenDate(now);
  return Array.from({ length: period }, (_, index) => addDays(today, index - period + 1));
}

/** Every calendar day from `start` to `end`, both included. */
export function calendarSpan(start: string, end: string): string[] {
  const days: string[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

export const weekdayOf = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();

/**
 * The workdays among `days` that have started. A day starts at 09:00 Copenhagen time, when the
 * Workday Default begins to apply, so this morning is not counted before then.
 */
export function startedWorkdays(days: readonly string[], now: Date = new Date()): string[] {
  return days.filter(
    (day) =>
      weekdayOf(day) >= 1 &&
      weekdayOf(day) <= 5 &&
      copenhagenWallClock(day, 9, 0).getTime() <= now.getTime()
  );
}

export const workdaysInPeriod = (period: number, now: Date = new Date()): string[] =>
  startedWorkdays(calendarDays(period, now), now);

/** A database `timestamp` string as the Copenhagen day it falls on. These are stored in UTC. */
export function copenhagenDayOf(timestamp: string): string {
  const iso = timestamp.replace(' ', 'T');
  const offset = /([+-])(\d{2})(?::?(\d{2}))?$/.exec(iso.slice(10));
  if (offset) {
    const withoutOffset = iso.slice(0, iso.length - offset[0].length);
    return copenhagenDate(
      new Date(`${withoutOffset}${offset[1]}${offset[2]}:${offset[3] ?? '00'}`)
    );
  }
  return copenhagenDate(new Date(iso.endsWith('Z') ? iso : `${iso}Z`));
}

/**
 * The first day a person can be counted: when their account was created or when they first
 * announced something, whichever is earlier. Before that the Workday Default would count them as
 * in the office on days they were not on record at all.
 */
export function trackedFrom(createdAt: string, firstAnnouncedDay: string | null): string {
  const joined = copenhagenDayOf(createdAt);
  return firstAnnouncedDay && firstAnnouncedDay < joined ? firstAnnouncedDay : joined;
}

const firstIndexFrom = (days: readonly string[], day: string, start = 0) => {
  let low = start;
  let high = days.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (days[middle]! < day) low = middle + 1;
    else high = middle;
  }
  return low;
};

const firstIndexAfter = (days: readonly string[], day: string, start = 0) => {
  let low = start;
  let high = days.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (days[middle]! <= day) low = middle + 1;
    else high = middle;
  }
  return low;
};

export function codeOfPresence(presence: DayPresence | undefined): number {
  const group = presence?.status?.status ? groupOfStatus.get(presence.status.status) : undefined;
  return group ? GROUP_KEYS.indexOf(group) : NO_STATUS_CODE;
}

/**
 * One day's code, read the way `resolveWorkWeek` reads it: at the start of the workday, or live
 * for today. The tests hold the two to the same answer.
 */
function codeOn(
  statuses: readonly Status[],
  userId: string,
  day: string,
  today: string,
  now: Date
): number {
  const moment = day === today ? now : copenhagenWallClock(day, 9, 0);
  const presence = resolvePresenceStatus(statuses, userId, moment);
  const group = presence?.status ? groupOfStatus.get(presence.status) : undefined;
  return group ? GROUP_KEYS.indexOf(group) : NO_STATUS_CODE;
}

/**
 * One person's resolved presence on each workday as `DayCode`s, the same as `resolveWorkWeek`
 * gives. Days before `firstDay` are untracked. Resolving a day looks at every status the person
 * has, so each day is only given the statuses that can matter to it: those whose dates include
 * the day, or whose clock times fall on it. A day left with none of them is the Workday Default
 * (checked once instead of per day), except today, which is always resolved live.
 */
export function resolveEmployeeCodes(
  statuses: readonly Status[],
  userId: string,
  workdays: readonly string[],
  firstDay: string,
  now: Date
): Int8Array {
  const codes = new Int8Array(workdays.length).fill(UNTRACKED_CODE);
  const first = firstIndexFrom(workdays, firstDay);
  if (first >= workdays.length) return codes;

  const perDay: (Status[] | undefined)[] = new Array(workdays.length);
  const add = (index: number, status: Status) => (perDay[index] ??= []).push(status);
  for (const status of statuses) {
    const from = status.fromDate ? firstIndexFrom(workdays, status.fromDate, first) : first;
    const to = status.toDate ? firstIndexAfter(workdays, status.toDate, first) : workdays.length;
    for (let index = from; index < to; index += 1) add(index, status);
    const clockDays = new Set(
      [status.startsAt, status.endsAt]
        .filter((value) => value != null)
        .map((value) => copenhagenDate(new Date(value)))
    );
    for (const day of clockDays) {
      const index = firstIndexFrom(workdays, day, first);
      if (workdays[index] === day && (index < from || index >= to)) add(index, status);
    }
  }

  const today = copenhagenDate(now);
  let defaultCode: number | null = null;
  for (let index = first; index < workdays.length; index += 1) {
    const day = workdays[index]!;
    const relevant = perDay[index];
    if (!relevant && day !== today) {
      defaultCode ??= codeOn([], userId, day, today, now);
      codes[index] = defaultCode;
    } else {
      codes[index] = codeOn(relevant ?? [], userId, day, today, now);
    }
  }
  return codes;
}

export type EmployeeDays = {
  counts: GroupCounts;
  /** Workdays without an attendance status, for example a day covered only by a note. */
  noStatus: number;
};

/** Add up a person's tracked days between two indexes (the end is exclusive). */
export function tallyCodes(
  codes: ArrayLike<number>,
  from = 0,
  to: number = codes.length
): EmployeeDays {
  const counts = emptyGroupCounts();
  let noStatus = 0;
  for (let index = from; index < to; index += 1) {
    const code = codes[index]!;
    if (code === NO_STATUS_CODE) noStatus += 1;
    else if (code >= 0) counts[GROUP_KEYS[code]!] += 1;
  }
  return { counts, noStatus };
}

export const tallyDays = (week: readonly DayPresence[]): EmployeeDays =>
  tallyCodes(week.map(codeOfPresence));

export const personDays = ({ counts, noStatus }: EmployeeDays) =>
  Object.values(counts).reduce((total, days) => total + days, noStatus);

export const workingDays = (counts: GroupCounts) =>
  WORKING_GROUPS.reduce((total, key) => total + counts[key], 0);

export const absenceDays = (counts: GroupCounts) => counts.sick + counts.vacation + counts.other;

/** Share of working days spent in the office. Absences are left out; null without working days. */
export function officeShare(counts: GroupCounts): number | null {
  const working = workingDays(counts);
  return working === 0 ? null : counts.office / working;
}

export type EmployeeRow = EmployeeDays & {
  userId: string;
  name: string;
  email: string;
};

export function sortEmployees(rows: readonly EmployeeRow[], sort: EmployeeSort): EmployeeRow[] {
  const byName = (a: EmployeeRow, b: EmployeeRow) =>
    a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || a.userId.localeCompare(b.userId);
  if (sort === 'name') return [...rows].sort(byName);
  return [...rows].sort((a, b) => b.counts[sort] - a.counts[sort] || byName(a, b));
}

export type WeekdayStats = {
  /** 1 for Monday to 5 for Friday. */
  weekday: number;
  /** How many of this weekday fall in the period. */
  days: number;
  /** Person-days in each group, summed over every occurrence of the weekday. */
  counts: GroupCounts;
};

export type EmployeeStats = {
  employees: EmployeeRow[];
  totals: EmployeeDays;
  weekdays: WeekdayStats[];
};

/** One person's resolved days, aligned with the workdays they were loaded for. */
export type PersonDays = {
  userId: string;
  name: string;
  email: string;
  codes: ArrayLike<number>;
};

export function mergeDays(target: EmployeeDays, source: EmployeeDays): void {
  target.noStatus += source.noStatus;
  for (const key of GROUP_KEYS) target.counts[key] += source.counts[key];
}

/** Person-days per group on each weekday, so the norm can be compared with one person. */
export function weekdayStats(
  people: readonly { codes: ArrayLike<number> }[],
  workdays: readonly string[]
): WeekdayStats[] {
  const weekdays: WeekdayStats[] = [1, 2, 3, 4, 5].map((weekday) => ({
    weekday,
    days: workdays.filter((day) => weekdayOf(day) === weekday).length,
    counts: emptyGroupCounts(),
  }));
  const weekdayIndexes = workdays.map((day) => weekdayOf(day) - 1);
  for (const { codes } of people) {
    for (let index = 0; index < workdays.length; index += 1) {
      const code = codes[index]!;
      const weekday = weekdays[weekdayIndexes[index]!];
      if (code >= 0 && code < NO_STATUS_CODE && weekday) weekday.counts[GROUP_KEYS[code]!] += 1;
    }
  }
  return weekdays;
}

/** Add up resolved attendance per person, for the whole company and for each weekday. */
export function summarizeEmployeeStats(
  people: readonly PersonDays[],
  workdays: readonly string[],
  sort: EmployeeSort = 'name'
): EmployeeStats {
  const totals: EmployeeDays = { counts: emptyGroupCounts(), noStatus: 0 };
  const employees = people.map(({ codes, ...person }) => {
    const days = tallyCodes(codes, 0, workdays.length);
    mergeDays(totals, days);
    return { ...person, ...days };
  });
  return {
    employees: sortEmployees(employees, sort),
    totals,
    weekdays: weekdayStats(people, workdays),
  };
}
