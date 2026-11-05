import type { ReplacedAnnouncement } from '@/db/schema';
import type { Status } from '@/db/types';
import { copenhagenWallClock, selectDayAnnouncement } from './active';
import { importedRevision } from './correction';
import type { PlannedStatus } from './plan';
import { addDays } from './week';

/**
 * What the colleague's days showed before an admin's planned status, one entry per run of
 * consecutive days with the same status. Days without a Declaration are left out.
 */
export function replacedAnnouncements(
  before: readonly Status[],
  planned: Pick<PlannedStatus, 'fromDate' | 'toDate'>,
  revisions: ReadonlyMap<string, string>
): ReplacedAnnouncement[] {
  const entries: ReplacedAnnouncement[] = [];
  if (!planned.fromDate || !planned.toDate) return entries;
  for (let day = planned.fromDate; day <= planned.toDate; day = addDays(day, 1)) {
    // The same reference time the week grid uses for its cells.
    const shown = selectDayAnnouncement(before, copenhagenWallClock(day, 9, 0));
    if (!shown) continue;
    const last = entries.at(-1);
    if (
      last &&
      last.statusId === shown.id &&
      last.status === shown.status &&
      addDays(last.toDay, 1) === day
    ) {
      last.toDay = day;
      continue;
    }
    const message = shown.sourceMessageKey
      ? { revision: revisions.get(shown.sourceMessageKey) ?? '' }
      : null;
    entries.push({
      statusId: shown.id,
      status: shown.status,
      details: shown.details,
      sourceMessageKey: shown.sourceMessageKey,
      sourceRevision: message?.revision ? importedRevision(shown, message) : null,
      fromDay: day,
      toDay: day,
    });
  }
  return entries;
}
