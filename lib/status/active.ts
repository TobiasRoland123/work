import type { Status } from '@/db/types';

type StatusLike = Pick<Status, 'createdAt' | 'fromDate' | 'toDate' | 'startsAt' | 'endsAt'> & {
  id?: number;
  startsAtApproximate?: boolean;
  endsAtApproximate?: boolean;
  announcedAt?: Date | string | null;
};

/** Copenhagen's calendar date, independent of the server's local timezone. */
export function copenhagenDate(value: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Copenhagen',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function instant(value: Date | string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function announcement(status: StatusLike): number | null {
  if (status.announcedAt) return instant(status.announcedAt);
  const value = status.createdAt;
  if (!value || /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) return instant(value);
  // Legacy created_at was a timestamp without timezone, written by the Danish
  // database. Preserve that Copenhagen wall-clock interpretation on any host.
  const normalized = value.replace(' ', 'T');
  const guess = Date.parse(`${normalized}Z`);
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Copenhagen',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  for (const offset of [1, 2]) {
    const candidate = guess - offset * 3600000;
    if (
      Number.isFinite(candidate) &&
      formatter.format(new Date(candidate)) === normalized.slice(0, 16).replace('T', ' ')
    )
      return candidate;
  }
  return null;
}

function localParts(value: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Copenhagen',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(value)
    .reduce<Record<string, string>>((parts, part) => {
      parts[part.type] = part.value;
      return parts;
    }, {});
}

/** Convert a Copenhagen wall clock into an instant for the current date. */
function copenhagenWallClock(day: string, hour: number, minute: number): Date {
  const guess = Date.UTC(
    Number(day.slice(0, 4)),
    Number(day.slice(5, 7)) - 1,
    Number(day.slice(8, 10)),
    hour,
    minute
  );
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Copenhagen',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  for (const offset of [1, 2]) {
    const candidate = new Date(guess - offset * 3600000);
    if (
      formatter.format(candidate) ===
      `${day} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    )
      return candidate;
  }
  return new Date(guess - 3600000);
}

function defaultOfficeStatus(userID: string, now: Date): Status | null {
  const parts = localParts(now);
  if (!['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(parts.weekday)) return null;
  const day = copenhagenDate(now);
  const startsAt = copenhagenWallClock(day, 9, 0);
  if (now < startsAt) return null;
  return {
    id: 0,
    userID,
    status: 'IN_OFFICE',
    details: null,
    fromDate: day,
    toDate: day,
    startsAt,
    endsAt: null,
    startsAtApproximate: false,
    endsAtApproximate: false,
    sourceMessageKey: null,
    time: null,
    createdAt: `${day} 09:00:00`,
    announcedAt: startsAt,
  };
}

function declaresToday(candidate: StatusLike, now: Date): boolean {
  // Ignore clock bounds to detect both planned and expired declarations today.
  // A declaration for another date never suppresses today's default.
  return (
    isStatusApplicable({ ...candidate, startsAt: null, endsAt: null }, now) ||
    [candidate.startsAt, candidate.endsAt].some((value) => {
      const timestamp = instant(value);
      return timestamp !== null && copenhagenDate(new Date(timestamp)) === copenhagenDate(now);
    })
  );
}

/** Whether a status should be visible at `now`. Date ranges are inclusive; instants are half open. */
export function isStatusApplicable(status: StatusLike, now: Date = new Date()): boolean {
  // Nominal approximate clocks are display information, not exact transitions.
  const startsAt = status.startsAtApproximate ? null : instant(status.startsAt);
  const endsAt = status.endsAtApproximate ? null : instant(status.endsAt);
  const nowMs = now.getTime();
  const today = copenhagenDate(now);
  if (status.fromDate && status.fromDate > today) return false;
  if (status.toDate && status.toDate < today) return false;

  if (startsAt !== null || endsAt !== null) {
    if (startsAt !== null && nowMs < startsAt) return false;
    if (endsAt !== null && nowMs >= endsAt) return false;
    return true;
  }

  if (status.fromDate || status.toDate) {
    return (
      (!status.fromDate || status.fromDate <= today) && (!status.toDate || today <= status.toDate)
    );
  }

  const createdAt = announcement(status);
  return createdAt !== null && copenhagenDate(new Date(createdAt)) === today;
}

export function selectActiveStatus<T extends StatusLike>(
  statuses: readonly T[],
  now: Date = new Date()
): T | null {
  const ordered = [...statuses].sort((a, b) => {
    const created = (announcement(b) ?? 0) - (announcement(a) ?? 0);
    return created || (b.id ?? 0) - (a.id ?? 0);
  });

  for (const candidate of ordered) {
    if (isStatusApplicable(candidate, now)) return candidate;
  }
  return null;
}

/** Resolve presence without writing synthetic defaults or transitions to the database. */
export function resolvePresenceStatus(
  statuses: readonly Status[],
  userID: string,
  now: Date = new Date()
): Status | null {
  const today = copenhagenDate(now);
  const candidates = statuses.flatMap((candidate): Status[] => {
    if (
      !declaresToday(candidate, now) ||
      candidate.startsAtApproximate ||
      candidate.endsAtApproximate ||
      !['IN_LATE', 'LEAVING_EARLY'].includes(candidate.status ?? '')
    )
      return [candidate];
    const arriving = candidate.status === 'IN_LATE';
    const boundary =
      instant(candidate.time) ?? instant(arriving ? candidate.endsAt : candidate.startsAt);
    if (boundary === null || copenhagenDate(new Date(boundary)) !== today) return [candidate];
    const clock = new Date(boundary);
    const dayStart = copenhagenWallClock(today, 0, 0);
    const officeStart = copenhagenWallClock(today, 9, 0);
    const timed: Status = {
      ...candidate,
      fromDate: today,
      toDate: today,
      startsAt: arriving ? dayStart : clock,
      endsAt: arriving ? clock : null,
    };
    const leavingNote = `Leaving at ${new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Copenhagen',
      hour: '2-digit',
      minute: '2-digit',
    }).format(clock)}`;
    const office: Status = {
      ...candidate,
      status: 'IN_OFFICE',
      fromDate: today,
      toDate: today,
      startsAt: arriving ? clock : officeStart,
      endsAt: arriving ? null : clock,
      time: null,
      details: arriving
        ? candidate.details
        : [leavingNote, candidate.details].filter(Boolean).join(' · '),
    };
    return [timed, office];
  });
  const active = selectActiveStatus(candidates, now);
  if (active) return active;
  if (statuses.some((candidate) => declaresToday(candidate, now))) return null;
  return defaultOfficeStatus(userID, now);
}
