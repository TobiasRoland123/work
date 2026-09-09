import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { send } from '@vercel/queue';
import { publishSlackMessage } from '@/lib/slack/queue';
import { processQueuedSlackMessage, SlackMessagePendingError } from '@/lib/slack/inbox';

const callbacks = vi.hoisted(() => ({
  handler: undefined as undefined | ((message: unknown) => Promise<void>),
  retry: undefined as undefined | ((error: unknown) => { afterSeconds: number }),
}));
vi.mock('@vercel/queue', () => ({
  send: vi.fn(),
  handleCallback: vi.fn((handler, options) => {
    callbacks.handler = handler;
    callbacks.retry = options.retry;
    return vi.fn();
  }),
}));
vi.mock('@/lib/slack/inbox', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/slack/inbox')>()),
  processQueuedSlackMessage: vi.fn(),
}));
import '@/app/api/queues/slack-status/route';

const job = { messageKey: 'TTEST:CTEST:1788766200.000001', revision: '1788766200.000001' };
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe('Slack queue publication', () => {
  it('publishes references only and deduplicates per message revision', async () => {
    await publishSlackMessage(job);
    await publishSlackMessage(job);
    await publishSlackMessage({ ...job, revision: '1788766500.000001' });
    const calls = vi.mocked(send).mock.calls;
    expect(calls[0]).toEqual([
      'slack-status',
      job,
      { retentionSeconds: 86400, idempotencyKey: expect.stringMatching(/^[a-f0-9]{64}$/) },
    ]);
    expect(calls[0][2]?.idempotencyKey).toBe(calls[1][2]?.idempotencyKey);
    expect(calls[0][2]?.idempotencyKey).not.toBe(calls[2][2]?.idempotencyKey);
  });
  it('propagates publication failure so Slack delivery can retry', async () => {
    vi.mocked(send).mockRejectedValueOnce(new Error('queue offline'));
    await expect(publishSlackMessage(job)).rejects.toThrow('queue offline');
  });
  it('refuses unexpected data such as raw message text', async () => {
    await expect(publishSlackMessage({ ...job, text: 'private' } as typeof job)).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });
});

describe('Slack queue consumer', () => {
  it('processes the referenced revision and permits acknowledgement on completion', async () => {
    await callbacks.handler!(job);
    expect(processQueuedSlackMessage).toHaveBeenCalledWith(job.messageKey, job.revision);
  });
  it('reschedules pending jobs using the database backoff instead of acknowledging', async () => {
    const pending = new SlackMessagePendingError(117);
    vi.mocked(processQueuedSlackMessage).mockRejectedValueOnce(pending);
    await expect(callbacks.handler!(job)).rejects.toBe(pending);
    expect(callbacks.retry!(pending)).toEqual({ afterSeconds: 117 });
  });
  it('retries unexpected failures without leaking provider or database errors', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(processQueuedSlackMessage).mockRejectedValueOnce(
      new Error('secret database credentials')
    );
    await expect(callbacks.handler!(job)).rejects.toThrow('Slack queue processing failed');
    expect(callbacks.retry!(new Error('failure'))).toEqual({ afterSeconds: 60 });
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret database credentials');
  });
  it('acknowledges malformed jobs without processing or logging their contents', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(callbacks.handler!({ text: 'private' })).resolves.toBeUndefined();
    expect(processQueuedSlackMessage).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('slack_queue', { outcome: 'invalid_job' });
  });
  it('registers a private queue trigger and removes the status-processing cron', () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
    expect(config.functions['app/api/queues/slack-status/route.ts'].experimentalTriggers).toEqual([
      { type: 'queue/v2beta', topic: 'slack-status', retryAfterSeconds: 60 },
    ]);
    expect(config.crons).toEqual([{ path: '/api/check-users', schedule: '0 0 * * *' }]);
  });
});
