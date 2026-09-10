import { and, eq, lte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { slackMessages, status, users } from '@/db/schema';
import { inspectSlackEvent } from './events';
import { descriptionRows, extractAttendance, statusRows } from './extraction';
import { supabase } from '@/lib/supabaseClient';
import { notifySlackStatusNotSet } from './client';

export async function enqueueSlackEvent(input: unknown) {
  const inspected = inspectSlackEvent(
    input,
    process.env.SLACK_TEAM_ID ?? '',
    process.env.SLACK_CHANNEL_ID ?? ''
  );
  if (!inspected.event) return { outcome: 'ignored' as const, reason: inspected.reason };
  const event = inspected.event;
  const changed = await db.transaction(async (tx) => {
    const [changed] = await tx
      .insert(slackMessages)
      .values({ ...event, receivedAt: new Date(), nextAttemptAt: new Date() })
      .onConflictDoUpdate({
        target: slackMessages.messageKey,
        set: {
          ...event,
          attempts: 0,
          receivedAt: new Date(),
          nextAttemptAt: new Date(),
          outcome: null,
        },
        // Slack ts values are decimal strings. Numeric comparison handles out-of-order events.
        setWhere: sql`${slackMessages.revision}::numeric < ${event.revision}::numeric`,
      })
      .returning({ key: slackMessages.messageKey });
    if (changed) {
      // Only explicit deletion withdraws valid status before re-extraction.
      if (event.state === 'deleted')
        await tx.delete(status).where(eq(status.sourceMessageKey, event.messageKey));
      if (event.text && event.text.length > 12000) {
        await tx
          .update(slackMessages)
          .set({ text: null, state: 'review', outcome: { reason: 'unsupported' } })
          .where(eq(slackMessages.messageKey, event.messageKey));
      }
    }
    return Boolean(changed);
  });
  return {
    outcome: !changed
      ? ('duplicate_or_stale' as const)
      : event.state === 'deleted'
        ? ('deleted' as const)
        : event.text && event.text.length > 12000
          ? ('review' as const)
          : ('queued' as const),
    messageKey: event.messageKey,
    revision: event.revision,
  };
}

export async function broadcastSlackStatus() {
  if (supabase)
    await supabase
      .channel('status-sync')
      .send({ type: 'broadcast', event: 'status_updated', payload: {} });
}

export async function cleanupExpiredSlackMessages() {
  // Also called by daily directory maintenance when there are no new messages.
  await db
    .update(slackMessages)
    .set({ text: null, state: 'review', outcome: { reason: 'processing_expired' } })
    .where(
      and(
        eq(slackMessages.state, 'pending'),
        lte(slackMessages.receivedAt, new Date(Date.now() - 86400000))
      )
    );
}

export async function processSlackInbox(limit = 2, messageKey?: string, revision?: string) {
  await cleanupExpiredSlackMessages();
  const counts = { applied: 0, review: 0, ignored: 0, retried: 0, superseded: 0 };
  for (let i = 0; i < limit; i++) {
    const job = await db.transaction(async (tx) => {
      const [candidate] = await tx
        .select()
        .from(slackMessages)
        .where(
          and(
            eq(slackMessages.state, 'pending'),
            lte(slackMessages.nextAttemptAt, new Date()),
            messageKey ? eq(slackMessages.messageKey, messageKey) : undefined,
            revision ? eq(slackMessages.revision, revision) : undefined
          )
        )
        .orderBy(slackMessages.nextAttemptAt)
        .limit(1)
        .for('update', { skipLocked: true });
      if (!candidate) return null;
      if (candidate.attempts >= 5) {
        // A killed process may never reach the catch block. Bound those attempts too.
        await tx
          .update(slackMessages)
          .set({ state: 'review', text: null, outcome: { reason: 'processing_failed' } })
          .where(eq(slackMessages.messageKey, candidate.messageKey));
        counts.review++;
        return null;
      }
      await tx
        .update(slackMessages)
        .set({ nextAttemptAt: new Date(Date.now() + 120000), attempts: candidate.attempts + 1 })
        .where(eq(slackMessages.messageKey, candidate.messageKey));
      return candidate;
    });
    if (!job) break;
    let failureReason = 'identity_lookup_failed';
    try {
      const [user] = await db
        .select({ id: users.userId })
        .from(users)
        .where(
          and(
            eq(users.slackTeamId, job.teamId),
            eq(users.slackUserId, job.slackUserId ?? ''),
            eq(users.slackDeactivated, false)
          )
        )
        .limit(1);
      // Directory sync can catch up before the next retry; never guess identity from names.
      if (!user) {
        failureReason = 'unmapped_user';
        throw new Error('Unmapped Slack user');
      }
      failureReason = process.env.AI_GATEWAY_API_KEY?.trim()
        ? 'extraction_failed'
        : 'gateway_key_missing';
      const extraction = await extractAttendance(
        job.text ?? '',
        new Date(Number(job.messageTs) * 1000)
      );
      const rows =
        extraction.decision === 'apply'
          ? statusRows(extraction)
          : descriptionRows(extraction, job.text ?? '', new Date(Number(job.messageTs) * 1000));
      const hasRows = rows.length > 0;
      failureReason = 'status_write_failed';
      const applied = await db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(slackMessages)
          .where(eq(slackMessages.messageKey, job.messageKey))
          .for('update');
        if (!current || current.revision !== job.revision || current.state !== 'pending')
          return false;
        if (hasRows) {
          await tx.delete(status).where(eq(status.sourceMessageKey, job.messageKey));
          await tx.insert(status).values(
            rows.map((row) => ({
              ...row,
              userID: user.id,
              sourceMessageKey: job.messageKey,
              createdAt: new Date(Number(job.revision) * 1000).toISOString(),
              announcedAt: new Date(Number(job.revision) * 1000),
            }))
          );
        }
        await tx
          .update(slackMessages)
          .set({
            text: null,
            state: hasRows ? 'applied' : extraction.decision === 'ignore' ? 'ignored' : 'review',
            outcome: { reason: extraction.reason },
          })
          .where(eq(slackMessages.messageKey, job.messageKey));
        return true;
      });
      if (!applied) counts.superseded++;
      else if (hasRows) counts.applied++;
      else if (extraction.decision === 'review') counts.review++;
      else counts.ignored++;
      // Description-only rows do not set attendance. Notify only after this revision
      // commits, so duplicate deliveries and superseded results do not send replies.
      if (applied && !rows.some((row) => row.status !== null) && job.slackUserId) {
        try {
          await notifySlackStatusNotSet(job.channelId, job.slackUserId, job.messageTs);
        } catch {
          // A Slack outage must not restart extraction or undo a committed result.
          console.warn('slack_notification_failed', {
            messageKey: job.messageKey,
            revision: job.revision,
          });
        }
      }
      console.info('slack_processing', {
        messageKey: job.messageKey,
        outcome: applied ? (hasRows ? 'apply' : extraction.decision) : 'superseded',
        reason: extraction.reason,
      });
    } catch {
      const exhausted = job.attempts >= 4;
      await db
        .update(slackMessages)
        .set({
          state: exhausted ? 'review' : 'pending',
          ...(exhausted ? { text: null, outcome: { reason: 'processing_failed' } } : {}),
          nextAttemptAt: new Date(Date.now() + Math.min(3600000, 60000 * 2 ** job.attempts)),
        })
        .where(
          and(
            eq(slackMessages.messageKey, job.messageKey),
            eq(slackMessages.revision, job.revision),
            eq(slackMessages.state, 'pending')
          )
        );
      if (exhausted) counts.review++;
      else counts.retried++;
      console.warn('slack_processing', {
        messageKey: job.messageKey,
        outcome: exhausted ? 'review' : 'retry',
        reason: failureReason,
        attempt: job.attempts + 1,
      });
    }
  }
  if (counts.applied) {
    // A failed broadcast must not turn a successfully committed import into a retry.
    try {
      await broadcastSlackStatus();
    } catch {
      /* The dashboard also refreshes periodically. */
    }
  }
  return counts;
}

export class SlackMessagePendingError extends Error {
  constructor(public readonly afterSeconds: number) {
    super('Slack message is still pending');
    this.name = 'SlackMessagePendingError';
  }
}

export async function processQueuedSlackMessage(messageKey: string, revision: string) {
  await processSlackInbox(1, messageKey, revision);
  const [job] = await db
    .select({
      state: slackMessages.state,
      revision: slackMessages.revision,
      nextAttemptAt: slackMessages.nextAttemptAt,
    })
    .from(slackMessages)
    .where(eq(slackMessages.messageKey, messageKey));
  if (!job || job.revision !== revision) return;
  if (job.state === 'pending') {
    // A retry/backoff or another worker's lease is not successful completion.
    // Throw so Vercel Queues retains the delivery until the database job is terminal.
    throw new SlackMessagePendingError(
      Math.max(1, Math.ceil((job.nextAttemptAt.getTime() - Date.now()) / 1000))
    );
  }
  if (job.state === 'deleted') await broadcastSlackStatus();
}
