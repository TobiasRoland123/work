import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { slackAiUsage, slackMessageProcessing } from '@/db/schema';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type MessageIdentity = { messageKey: string; teamId: string; channelId: string };

/** Record a committed extraction without counting retries or edits as new messages. */
export async function recordSlackMessageProcessing(tx: Transaction, identity: MessageIdentity) {
  const usedAi = sql<boolean>`exists (
    select 1 from ${slackAiUsage}
    where ${slackAiUsage.messageKey} = ${identity.messageKey}
  )`;
  await tx
    .insert(slackMessageProcessing)
    .values({
      messageKey: identity.messageKey,
      teamId: identity.teamId,
      channelId: identity.channelId,
      usedAi,
    })
    .onConflictDoUpdate({
      target: slackMessageProcessing.messageKey,
      set: { usedAi: sql`${slackMessageProcessing.usedAi} or ${usedAi}` },
    });
}
