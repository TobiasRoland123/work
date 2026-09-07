import { and, eq, lte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { slackMessages, status, users } from '@/db/schema';
import { normalizeSlackEvent } from './events';
import { extractAttendance, statusRows } from './extraction';
import { supabase } from '@/lib/supabaseClient';

export async function enqueueSlackEvent(input: unknown) {
  const event = normalizeSlackEvent(
    input,
    process.env.SLACK_TEAM_ID ?? '',
    process.env.SLACK_CHANNEL_ID ?? ''
  );
  if (!event) return false;
  await db.transaction(async (tx) => {
    const [changed] = await tx
      .insert(slackMessages)
      .values(event)
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
  });
  return true;
}

async function broadcast() {
  if (supabase)
    await supabase
      .channel('status-sync')
      .send({ type: 'broadcast', event: 'status_updated', payload: {} });
}

export async function processSlackInbox(limit = 2) {
  // Purge text on abandoned jobs even when the AI or identity service remains unavailable.
  await db
    .update(slackMessages)
    .set({ text: null, state: 'review', outcome: { reason: 'processing_expired' } })
    .where(
      and(
        eq(slackMessages.state, 'pending'),
        lte(slackMessages.receivedAt, new Date(Date.now() - 86400000))
      )
    );
  const counts = { applied: 0, review: 0, ignored: 0, retried: 0, superseded: 0 };
  for (let i = 0; i < limit; i++) {
    const job = await db.transaction(async (tx) => {
      const [candidate] = await tx
        .select()
        .from(slackMessages)
        .where(
          and(eq(slackMessages.state, 'pending'), lte(slackMessages.nextAttemptAt, new Date()))
        )
        .orderBy(slackMessages.nextAttemptAt)
        .limit(1)
        .for('update', { skipLocked: true });
      if (!candidate) return null;
      await tx
        .update(slackMessages)
        .set({ nextAttemptAt: new Date(Date.now() + 120000), attempts: candidate.attempts + 1 })
        .where(eq(slackMessages.messageKey, candidate.messageKey));
      return candidate;
    });
    if (!job) break;
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
      if (!user) throw new Error('Unmapped Slack user');
      const extraction = await extractAttendance(
        job.text ?? '',
        new Date(Number(job.messageTs) * 1000)
      );
      const applied = await db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(slackMessages)
          .where(eq(slackMessages.messageKey, job.messageKey))
          .for('update');
        if (!current || current.revision !== job.revision || current.state !== 'pending')
          return false;
        if (extraction.decision === 'apply') {
          await tx.delete(status).where(eq(status.sourceMessageKey, job.messageKey));
          await tx.insert(status).values(
            statusRows(extraction).map((row) => ({
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
            state:
              extraction.decision === 'apply'
                ? 'applied'
                : extraction.decision === 'ignore'
                  ? 'ignored'
                  : 'review',
            outcome: { reason: extraction.reason },
          })
          .where(eq(slackMessages.messageKey, job.messageKey));
        return true;
      });
      if (!applied) counts.superseded++;
      else if (extraction.decision === 'apply') counts.applied++;
      else if (extraction.decision === 'review') counts.review++;
      else counts.ignored++;
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
    }
  }
  if (counts.applied) {
    // A failed broadcast must not turn a successfully committed import into a retry.
    try {
      await broadcast();
    } catch {
      /* The dashboard also refreshes periodically. */
    }
  }
  return counts;
}
