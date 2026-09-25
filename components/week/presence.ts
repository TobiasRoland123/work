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

export const dayGroups: { id: DayGroup; label: string }[] = [
  { id: 'office', label: 'In office' },
  { id: 'elsewhere', label: 'Working elsewhere' },
  { id: 'out', label: 'Out' },
  { id: 'unknown', label: 'No status yet' },
];

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

/** A Workday Default: nobody announced anything, so the office is assumed. */
export const isAssumed = (status: Status | null) => status?.id === 0;

export function presenceOf(status: Status | null): { label: string; tone: Tone; group: DayGroup } {
  if (!status) return { label: 'No status', tone: 'none', group: 'unknown' };
  if (!status.status) return { label: 'Note', tone: 'note', group: 'unknown' };
  return presence[status.status];
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
