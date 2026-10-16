import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { statusCorrections } from '@/db/schema';
import { getSlackMessage } from '@/lib/slack/client';
import { isSandbox, SANDBOX_TEAM_ID } from '@/lib/sandbox/enabled';

/** The same bound the inbox uses for retained review text. */
export const MAX_SOURCE_TEXT_LENGTH = 12000;

/**
 * Store the Slack text behind a correction, so reviewers can find recurring misread phrases.
 * The inbox clears the text of messages that produced a status, so it is fetched from Slack
 * only for messages someone corrected, and only while Slack still shows the exact revision
 * that was corrected. Best effort: a failure leaves the text empty and the correction intact.
 */
export async function recordCorrectionSourceText(correctionId: number): Promise<boolean> {
  try {
    const [correction] = await db
      .select({
        messageKey: statusCorrections.sourceMessageKey,
        revision: statusCorrections.sourceRevision,
      })
      .from(statusCorrections)
      .where(and(eq(statusCorrections.id, correctionId), isNull(statusCorrections.sourceText)));
    if (!correction?.revision) return false;
    const [teamId, channelId, messageTs, extra] = correction.messageKey.split(':');
    if (
      extra !== undefined ||
      teamId !== process.env.SLACK_TEAM_ID ||
      channelId !== process.env.SLACK_CHANNEL_ID ||
      // Nothing in the Local Sandbox contacts Slack.
      (isSandbox() && teamId === SANDBOX_TEAM_ID)
    )
      return false;

    const message = await getSlackMessage(channelId, messageTs);
    const revision = message?.edited?.ts ?? message?.ts;
    if (!message?.text || revision !== correction.revision) return false;
    const saved = await db
      .update(statusCorrections)
      .set({ sourceText: message.text.slice(0, MAX_SOURCE_TEXT_LENGTH) })
      .where(
        and(
          eq(statusCorrections.id, correctionId),
          eq(statusCorrections.sourceRevision, revision),
          isNull(statusCorrections.sourceText)
        )
      )
      .returning({ id: statusCorrections.id });
    return saved.length > 0;
  } catch (error) {
    console.warn('status_correction_text', {
      correctionId,
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return false;
  }
}
