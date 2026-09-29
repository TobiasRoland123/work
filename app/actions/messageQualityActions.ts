'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/db';
import { slackMessageFeedback, slackMessages, userStatus } from '@/db/schema';
import { requireMessageReviewer } from '@/lib/auth/message-review';

const feedbackInput = z.object({
  messageKey: z.string().min(1).max(255),
  revision: z.string().regex(/^\d{10,}\.\d{6}$/),
  status: z.enum(userStatus.enumValues),
  note: z.string().max(2000),
});

const terminalStates = new Set(['applied', 'review', 'ignored']);

function hasClearLegacyOutcome(outcome: unknown): boolean {
  return (
    typeof outcome === 'object' &&
    outcome !== null &&
    'reason' in outcome &&
    outcome.reason === 'clear'
  );
}

export async function saveExpectedStatusAction(input: {
  messageKey: string;
  revision: string;
  status: (typeof userStatus.enumValues)[number];
  note: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const reviewerUserId = await requireMessageReviewer();
  const parsed = feedbackInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'The expected status feedback is invalid.' };

  const { messageKey, revision, status: preferredStatus, note } = parsed.data;
  const now = new Date();
  const saved = await db.transaction(async (tx) => {
    const [message] = await tx
      .select({
        state: slackMessages.state,
        convertedToStatus: slackMessages.convertedToStatus,
        outcome: slackMessages.outcome,
      })
      .from(slackMessages)
      .where(
        and(
          eq(slackMessages.messageKey, messageKey),
          eq(slackMessages.revision, revision),
          eq(slackMessages.teamId, process.env.SLACK_TEAM_ID ?? ''),
          eq(slackMessages.channelId, process.env.SLACK_CHANNEL_ID ?? '')
        )
      )
      .for('update');

    if (!message || !terminalStates.has(message.state) || message.convertedToStatus === true)
      return false;

    // Preserve the dashboard's legacy conversion fallback for rows created before the flag existed.
    if (
      message.convertedToStatus === null &&
      message.state === 'applied' &&
      hasClearLegacyOutcome(message.outcome)
    )
      return false;

    await tx
      .insert(slackMessageFeedback)
      .values({
        messageKey,
        revision,
        preferredStatus,
        note: note.trim() || null,
        reviewerUserId,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [slackMessageFeedback.messageKey, slackMessageFeedback.revision],
        set: {
          preferredStatus,
          note: note.trim() || null,
          reviewerUserId,
          updatedAt: now,
        },
      });
    return true;
  });

  if (!saved)
    return { ok: false, error: 'This message changed or is no longer available for review.' };
  revalidatePath('/message-quality');
  return { ok: true };
}
