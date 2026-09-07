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
