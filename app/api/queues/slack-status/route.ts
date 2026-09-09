import { handleCallback } from '@vercel/queue';
import { processQueuedSlackMessage, SlackMessagePendingError } from '@/lib/slack/inbox';
import { slackMessageJob } from '@/lib/slack/queue';

export const runtime = 'nodejs';
export const maxDuration = 60;

// vercel.json makes this a private queue consumer, invoked by Vercel infrastructure.
export const POST = handleCallback(
  async (message: unknown) => {
    const parsed = slackMessageJob.safeParse(message);
    if (!parsed.success) {
      console.error('slack_queue', { outcome: 'invalid_job' });
      return;
    }
    const { messageKey, revision } = parsed.data;
    try {
      await processQueuedSlackMessage(messageKey, revision);
    } catch (error) {
      if (error instanceof SlackMessagePendingError) throw error;
      console.error('slack_queue', { outcome: 'worker_failed', messageKey, revision });
      // SDK diagnostics must not include database/provider exception bodies or credentials.
      throw new Error('Slack queue processing failed');
    }
  },
  {
    visibilityTimeoutSeconds: 120,
    retry: (error) => ({
      afterSeconds: error instanceof SlackMessagePendingError ? error.afterSeconds : 60,
    }),
  }
);
