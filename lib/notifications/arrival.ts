import type { Status } from '@/db/types';
import { resolvePresenceStatus } from '@/lib/status/active';

/**
 * Whether new Declarations moved a person into the office at `now`. Resolved Status is never
 * stored, so an arrival is the change between what it was and what it is once the Declarations
 * are included. The Workday Default alone is never an arrival: it needs no announcement.
 */
export function arrivedInOffice(
  before: readonly Status[],
  after: readonly Status[],
  userId: string,
  now: Date = new Date()
): boolean {
  const was = resolvePresenceStatus(before, userId, now)?.status;
  const is = resolvePresenceStatus(after, userId, now)?.status;
  return was !== 'IN_OFFICE' && is === 'IN_OFFICE';
}

/** Who is in the office now and who is arriving later today, from statuses by person. */
export function presentToday(
  statusesByUser: ReadonlyMap<string, readonly Status[]>,
  now: Date = new Date()
): { inOffice: string[]; arrivingLater: string[] } {
  const inOffice: string[] = [];
  const arrivingLater: string[] = [];
  for (const [userId, statuses] of statusesByUser) {
    const resolved = resolvePresenceStatus(statuses, userId, now)?.status;
    if (resolved === 'IN_OFFICE') inOffice.push(userId);
    else if (resolved === 'IN_LATE') arrivingLater.push(userId);
  }
  return { inOffice, arrivingLater };
}
