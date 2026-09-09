import { createHash } from 'node:crypto';
import { send } from '@vercel/queue';
import { z } from 'zod';

// Publish references only. Raw Slack text remains in the short-lived database inbox.
export const slackMessageJob = z
  .object({
    messageKey: z.string().min(1).max(256),
    revision: z.string().regex(/^\d{10,}\.[0-9]{6}$/),
  })
  .strict();

export type SlackMessageJob = z.infer<typeof slackMessageJob>;

export async function publishSlackMessage(job: SlackMessageJob) {
  const payload = slackMessageJob.parse(job);
  await send('slack-status', payload, {
    idempotencyKey: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
    retentionSeconds: 86400,
  });
}
