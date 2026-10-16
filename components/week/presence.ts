import type { DayPresence, Status, UserWithExtras } from '@/db/types';
import type { StatusType } from '@/components/ui/Status/Status';

export type Tone = 'office' | 'partial' | 'remote' | 'sick' | 'off' | 'away' | 'note' | 'none';
export type DayGroup = 'office' | 'elsewhere' | 'out' | 'unknown';

const presence: Record<StatusType, { label: string; tone: Tone; group: DayGroup }> = {
  IN_OFFICE: { label: 'In office', tone: 'office', group: 'office' },
  IN_LATE: { label: 'In late', tone: 'partial', group: 'office' },
  LEAVING_EARLY: { label: 'Leaving early', tone: 'partial', group: 'office' },
  FROM_HOME: { label: 'Home', tone: 'remote', group: 'elsewhere' },
  AT_CLIENT: { label: 'At client', tone: 'remote', group: 'elsewhere' },
  SICK: { label: 'Sick', tone: 'sick', group: 'out' },
  CHILD_SICK: { label: 'Child sick', tone: 'sick', group: 'out' },
  VACATION: { label: 'Vacation', tone: 'off', group: 'out' },
  ON_LEAVE: { label: 'On leave', tone: 'off', group: 'out' },
  AWAY: { label: 'Away', tone: 'away', group: 'out' },
};

export const legend: { tone: Tone; label: string }[] = [
  { tone: 'office', label: 'In office' },
  { tone: 'partial', label: 'Late / leaving early' },
  { tone: 'remote', label: 'Home / client' },
  { tone: 'sick', label: 'Sick' },
  { tone: 'off', label: 'Vacation / leave' },
  { tone: 'away', label: 'Away' },
];

export const personName = (person: UserWithExtras) =>
  [person.firstName, person.lastName].filter(Boolean).join(' ') || person.email;

export const initials = (person: UserWithExtras) =>
  personName(person)
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export const isInOffice = (person: UserWithExtras) => person.status?.status === 'IN_OFFICE';

/** Every attendance status, in display order. */
export const statusTypes = Object.keys(presence) as StatusType[];

export const statusLabel = (status: StatusType) => presence[status].label;

/** A Workday Default: nobody announced anything, so the office is assumed. */
export const isAssumed = (status: Status | null) => status?.id === 0;

export function presenceOf(status: Status | null): { label: string; tone: Tone; group: DayGroup } {
  if (!status) return { label: 'No status', tone: 'none', group: 'unknown' };
  if (!status.status) return { label: 'Note', tone: 'note', group: 'unknown' };
  return presence[status.status];
}

type AttendanceGroup = {
  key: StatusType | 'note' | 'unknown';
  label: string;
  tone: Tone;
  members: UserWithExtras[];
};

/** Group the supplied colleagues by one day's status, preserving their order within each group. */
export function groupAttendance(people: readonly UserWithExtras[], day: string): AttendanceGroup[] {
  const groups = new Map<string, AttendanceGroup>();
  for (const person of people) {
    const status = person.week?.find((entry) => entry.date === day)?.status ?? null;
    const key = status ? (status.status ?? 'note') : 'unknown';
    const { label, tone } = presenceOf(status);
    const group = groups.get(key) ?? { key, label, tone, members: [] };
    group.members.push(person);
    groups.set(key, group);
  }
  return [...Object.keys(presence), 'note', 'unknown'].flatMap((key) => {
    const group = groups.get(key);
    return group ? [group] : [];
  });
}

export type ExceptionGroupKey = 'out' | 'elsewhere' | 'partly';

export const exceptionGroups: { key: ExceptionGroupKey; label: string; tone: Tone }[] = [
  { key: 'out', label: 'Out', tone: 'off' },
  { key: 'elsewhere', label: 'Working elsewhere', tone: 'remote' },
  { key: 'partly', label: 'Partly in', tone: 'partial' },
];

/** The day list's group for one day's status. Late arrivals and early departures are "Partly in". */
export function exceptionGroupOf(status: Status | null): ExceptionGroupKey | null {
  const { tone, group } = presenceOf(status);
  if (tone === 'partial') return 'partly';
  return group === 'out' || group === 'elsewhere' ? group : null;
}

/**
 * Split colleagues by one day's status for the day list, preserving their order. People in the
 * office that day are kept apart, as are notes and missing statuses.
 */
export function groupExceptions(people: readonly UserWithExtras[], day: string) {
  const groups = exceptionGroups.map((group) => ({ ...group, members: [] as UserWithExtras[] }));
  const other: UserWithExtras[] = [];
  const inOffice: UserWithExtras[] = [];
  for (const person of people) {
    const status = person.week?.find((entry) => entry.date === day)?.status ?? null;
    const key = exceptionGroupOf(status);
    if (key) groups.find((group) => group.key === key)?.members.push(person);
    else if (status?.status === 'IN_OFFICE') inOffice.push(person);
    else other.push(person);
  }
  return { groups, other, inOffice };
}

function clock(value: Date | string | null | undefined, approximate?: boolean | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Copenhagen',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return approximate ? `ca. ${time}` : time;
}

export const shortDate = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}`;

/** Arrival or departure time for timed statuses, e.g. "from 10:00". */
export function timeNote(status: Status | null): string | null {
  if (status?.status === 'IN_OFFICE' && status.time) {
    const time = clock(status.time);
    return time && `from ${time}`;
  }
  if (status?.status === 'IN_LATE') {
    const time = clock(status.time ?? status.endsAt, status.endsAtApproximate);
    return time && `from ${time}`;
  }
  if (status?.status === 'LEAVING_EARLY') {
    const time = clock(status.time ?? status.startsAt, status.startsAtApproximate);
    return time && `until ${time}`;
  }
  return null;
}

export type Segment = { start: number; span: number; status: Status | null };

/** Merge consecutive days covered by the same announcement into one segment. */
export function segmentWeek(week: readonly DayPresence[]): Segment[] {
  const key = (status: Status | null, index: number) =>
    status && !isAssumed(status)
      ? `${status.id}:${status.status}:${status.details ?? ''}`
      : `day-${index}`;
  return week.reduce<Segment[]>((segments, day, index) => {
    const last = segments.at(-1);
    if (last && key(last.status, last.start) === key(day.status, index)) last.span += 1;
    else segments.push({ start: index, span: 1, status: day.status });
    return segments;
  }, []);
}

/** Timing and details for one day, e.g. "from 10:00 · dentist first". */
export function dayNote(status: Status | null): string | null {
  return [timeNote(status), status?.details].filter(Boolean).join(' · ') || null;
}

/** Day note plus the announced range when it reaches past the visible week. */
export function segmentNote(segment: Segment, days: readonly string[]): string | null {
  const { status } = segment;
  if (!status) return null;
  const first = days[segment.start];
  const last = days[segment.start + segment.span - 1];
  const range =
    status.toDate && status.toDate > last
      ? `until ${shortDate(status.toDate)}`
      : status.fromDate && status.fromDate < first
        ? `since ${shortDate(status.fromDate)}`
        : null;
  return [timeNote(status), range, status.details].filter(Boolean).join(' · ') || null;
}
