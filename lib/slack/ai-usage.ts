import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { slackAiUsage } from '@/db/schema';
import type { ExtractionAiUsage, ExtractionUsageObserver } from './ai-usage-types';

type MessageIdentity = {
  messageKey: string;
  revision: string;
  teamId: string;
  channelId: string;
};

export function createSlackAiUsageRecorder(identity: MessageIdentity): ExtractionUsageObserver {
  let attemptId: string | null = null;
  return {
    async onStart(model) {
      const id = randomUUID();
      await db.insert(slackAiUsage).values({ id, ...identity, model });
      attemptId = id;
    },
    async onFinish(usage: ExtractionAiUsage) {
      if (!attemptId) throw new Error('AI usage attempt was not started');
      const id = attemptId;
      attemptId = null;
      try {
        await db
          .update(slackAiUsage)
          .set({
            state: usage.state,
            completedAt: new Date(),
            costUsd: usage.costUsd,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            responseId: usage.responseId,
          })
          .where(eq(slackAiUsage.id, id));
      } catch {
        // The started row still captures a paid attempt with unknown final cost.
        console.warn('slack_ai_usage_finish_failed', { attemptId: id });
      }
    },
  };
}
