import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import { slackMessages, status } from '@/db/schema';
import { visibleStatusCondition } from '@/lib/status/visible';
import { copenhagenDate, localInstant, nextDate } from './extraction';

export type AttendanceContextEntry = {
  id: string;
  messageSentAt: string;
  announcedAt: string;
  text: string | null;
  replaceable: boolean;
  intervals: {
    status: string | null;
    fromDate: string | null;
    toDate: string | null;
    startTime: string | null;
    endTime: string | null;
    startApproximate: boolean;
    endApproximate: boolean;
  }[];
};
export type ContextJob = Pick<
  typeof slackMessages.$inferSelect,
  'messageKey' | 'teamId' | 'channelId' | 'slackUserId' | 'messageTs' | 'revision'
>;
export type AttendanceContext = {
  entries: AttendanceContextEntry[];
  sourceIds: Record<string, number[]>;
};
export class AttendanceContextPendingError extends Error {}

const clock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Copenhagen',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const localClock = (value: Date | null) => (value ? clock.format(value) : null);

/** Only earlier announcements by this author, in this channel, sent on the same local day. */
export async function loadAttendanceContext(
  job: ContextJob,
  userId: string,
  reader: Pick<typeof db, 'select'> = db
): Promise<AttendanceContext> {
  const day = copenhagenDate(new Date(Number(job.messageTs) * 1000));
  const prior = and(
    eq(slackMessages.teamId, job.teamId),
    eq(slackMessages.channelId, job.channelId),
    eq(slackMessages.slackUserId, job.slackUserId ?? ''),
    ne(slackMessages.messageKey, job.messageKey),
    sql`${slackMessages.revision}::numeric < ${job.revision}::numeric`,
    sql`${slackMessages.messageTs}::numeric >= ${localInstant(day, '00:00').getTime() / 1000}`,
    sql`${slackMessages.messageTs}::numeric < ${localInstant(nextDate(day), '00:00').getTime() / 1000}`
  );
  const [pending] = await reader
    .select({ key: slackMessages.messageKey })
    .from(slackMessages)
    .where(and(prior, eq(slackMessages.state, 'pending')))
    .limit(1);
  if (pending) throw new AttendanceContextPendingError('Earlier announcement is still processing');
  const messages = await reader
    .select()
    .from(slackMessages)
    .where(and(prior, eq(slackMessages.state, 'applied')))
    .orderBy(desc(sql`${slackMessages.revision}::numeric`))
    .limit(8)
    .for('share');
  if (!messages.length) return { entries: [], sourceIds: {} };
  const rows = await reader
    .select()
    .from(status)
    .where(
      and(
        eq(status.userID, userId),
        inArray(
          status.sourceMessageKey,
          messages.map((message) => message.messageKey)
        ),
        visibleStatusCondition({
          messageKey: job.messageKey,
          announcedAt: new Date(Number(job.revision) * 1000),
        })
      )
    )
    .orderBy(status.id)
    .for('share');
  const entries: AttendanceContextEntry[] = [];
  const sourceIds: Record<string, number[]> = {};
  for (const message of messages.reverse()) {
    const intervals = rows.filter((row) => row.sourceMessageKey === message.messageKey);
    if (!intervals.length) continue;
    const id = `prior_${entries.length + 1}`;
    const replaceable =
      intervals.every(
        (row) => row.status !== null && row.fromDate && row.fromDate === row.toDate
      ) && new Set(intervals.map((row) => row.fromDate)).size === 1;
    // Plain statuses intentionally have no retained source text. Never reconstruct a quote.
    const details = intervals.find((row) => row.details)?.details;
    const text =
      message.reviewText ??
      (details && !['Arrival time unspecified', 'Departure time unspecified'].includes(details)
        ? details
        : null);
    entries.push({
      id,
      messageSentAt: new Date(Number(message.messageTs) * 1000).toISOString(),
      announcedAt: new Date(Number(message.revision) * 1000).toISOString(),
      text: text?.slice(0, 1500) ?? null,
      replaceable,
      intervals: intervals.map((row) => ({
        status: row.status,
        fromDate: row.fromDate,
        toDate: row.toDate,
        startTime: localClock(row.startsAt) === '00:00' ? null : localClock(row.startsAt),
        endTime: localClock(row.endsAt) === '00:00' ? null : localClock(row.endsAt),
        startApproximate: row.startsAtApproximate,
        endApproximate: row.endsAtApproximate,
      })),
    });
    sourceIds[id] = intervals.map((row) => row.id);
  }
  return { entries, sourceIds };
}
