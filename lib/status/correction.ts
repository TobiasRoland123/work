import { z } from 'zod';
import { userStatus } from '@/db/schema';
import type { Status } from '@/db/types';
import { declarationDays, type PlannedStatus } from './plan';

export const correctionSchema = z.object({
  /** The imported Declaration shown for the corrected day. */
  statusId: z.number().int().positive(),
  /** The day the person opened the correction from. */
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Correct only that day, or every day the imported Declaration covers. */
  scope: z.enum(['day', 'declaration']),
  status: z.enum(userStatus.enumValues),
});
export type CorrectionInput = z.infer<typeof correctionSchema>;

/** A correction the person can fix or retry; the message is safe to show as is. */
export class CorrectionError extends Error {}

export const CORRECTION_UNAVAILABLE =
  'This Slack announcement changed or is no longer yours to correct. Refresh and try again.';

// Fallback notes the import adds to timeless arrivals and departures; they describe the
// original reading, so they would be misleading on a corrected status.
const importNotes = new Set(['Arrival time unspecified', 'Departure time unspecified']);

type Original = Pick<
  Status,
  | 'status'
  | 'details'
  | 'fromDate'
  | 'toDate'
  | 'time'
  | 'startsAt'
  | 'endsAt'
  | 'createdAt'
  | 'announcedAt'
  | 'sourceMessageKey'
>;

/** Turn a correction of an imported Declaration into the user Declaration that replaces it. */
export function planCorrection(original: Original, input: CorrectionInput): PlannedStatus {
  if (!original.sourceMessageKey) throw new CorrectionError(CORRECTION_UNAVAILABLE);
  const span = declarationDays(original);
  if (!span || input.day < span.firstDay || input.day > span.lastDay)
    throw new CorrectionError('That day is not part of this Slack announcement.');
  if (input.status === original.status)
    throw new CorrectionError('Slack already set this status. Choose the one it should be.');
  const [fromDate, toDate] =
    input.scope === 'day' ? [input.day, input.day] : [span.firstDay, span.lastDay];
  const details =
    input.status === 'SICK' || !original.details || importNotes.has(original.details)
      ? null
      : original.details;
  return { status: input.status, details, fromDate, toDate, time: null };
}

/**
 * The inbox revision that wrote an imported Declaration. Imports stamp `announcedAt` with the
 * revision time, so a later revision that left older rows in place no longer matches.
 */
export function importedRevision(
  original: Pick<Status, 'announcedAt'>,
  message: { revision: string } | null | undefined
): string | null {
  if (!message || !original.announcedAt) return null;
  const written = new Date(Number(message.revision) * 1000).getTime();
  return written === new Date(original.announcedAt).getTime() ? message.revision : null;
}

/** Whether a newer Declaration of the person's overlaps the corrected days. */
export function isSuperseded(
  declaration: Pick<Status, 'id' | 'announcedAt'>,
  statuses: readonly Status[],
  fromDate: string,
  toDate: string
): boolean {
  const announced = declaration.announcedAt ? new Date(declaration.announcedAt).getTime() : 0;
  return statuses.some((candidate) => {
    if (candidate.id === declaration.id || !candidate.announcedAt) return false;
    if (new Date(candidate.announcedAt).getTime() <= announced) return false;
    const span = declarationDays(candidate);
    return Boolean(span && span.firstDay <= toDate && fromDate <= span.lastDay);
  });
}
