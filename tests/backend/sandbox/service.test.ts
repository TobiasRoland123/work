import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTableName } from 'drizzle-orm';
import { SlackMessagePendingError } from '@/lib/slack/inbox';
import {
  announcementInstant,
  SandboxInputError,
  sendSandboxMessage,
  editSandboxMessage,
  deleteSandboxMessage,
} from '@/lib/sandbox/service';

// Rows returned per table, consumed in call order.
const rows = vi.hoisted(() => new Map<string, unknown[][]>());
vi.mock('@/db', () => {
  const chain = (table: unknown) => {
    const name = getTableName(table as never);
    const result = Promise.resolve(rows.get(name)?.shift() ?? []);
    const self: Record<string, unknown> = {
      where: () => self,
      orderBy: () => self,
      limit: () => self,
      then: result.then.bind(result),
    };
    return self;
  };
  return { db: { select: () => ({ from: chain }) } };
});
vi.mock('@/lib/slack/inbox', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/slack/inbox')>()),
  enqueueSlackEvent: vi.fn(),
  processQueuedSlackMessage: vi.fn(),
  processSlackInbox: vi.fn(),
}));
const inbox = await import('@/lib/slack/inbox');
const enqueue = vi.mocked(inbox.enqueueSlackEvent);
const consume = vi.mocked(inbox.processQueuedSlackMessage);

const author = 'U_LOCAL_ANNA';
function queue(table: string, ...results: unknown[][]) {
  rows.set(table, [...(rows.get(table) ?? []), ...results]);
}

beforeEach(() => {
  rows.clear();
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('SLACK_TEAM_ID', 'T_LOCAL');
  vi.stubEnv('SLACK_CHANNEL_ID', 'C_LOCAL');
  vi.stubEnv('AI_GATEWAY_API_KEY', 'synthetic-key');
  enqueue.mockReset();
  consume.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe('announcementInstant', () => {
  it('reads a Europe/Copenhagen wall clock', () => {
    expect(announcementInstant('2026-01-15T09:30').toISOString()).toBe('2026-01-15T08:30:00.000Z');
    expect(announcementInstant('2026-07-15T09:30').toISOString()).toBe('2026-07-15T07:30:00.000Z');
  });
  it('rejects malformed input and DST gaps', () => {
    expect(() => announcementInstant('yesterday')).toThrow('YYYY-MM-DDTHH:mm');
    expect(() => announcementInstant('2026-03-29T02:30')).toThrow('Ambiguous local time');
  });
});

describe('sendSandboxMessage', () => {
  it('refuses to send when the intake is configured for another workspace', async () => {
    vi.stubEnv('SLACK_TEAM_ID', 'T02HKL21R');
    await expect(sendSandboxMessage({ slackUserId: author, text: 'wfh' })).rejects.toBeInstanceOf(
      SandboxInputError
    );
    expect(enqueue).not.toHaveBeenCalled();
  });
  it('fails up front without an AI key unless shorthand handles the text', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', '');
    queue('users', [{ id: 'sandbox-anna' }]);
    await expect(
      sendSandboxMessage({ slackUserId: author, text: 'in later, dentist' })
    ).rejects.toThrow('AI_GATEWAY_API_KEY');
    expect(enqueue).not.toHaveBeenCalled();
    queue('users', [{ id: 'sandbox-anna' }], [{ id: 'sandbox-anna' }]);
    queue('slack_messages', [{ state: 'applied', outcome: { reason: 'clear' }, attempts: 1 }]);
    queue('slack_messages', [{ state: 'applied', outcome: { reason: 'clear' } }]);
    queue('status', []);
    enqueue.mockResolvedValue({ outcome: 'queued', messageKey: 'k', revision: 'r' });
    await expect(sendSandboxMessage({ slackUserId: author, text: 'wfh' })).resolves.toMatchObject({
      handledBy: 'shorthand',
    });
  });
  it('feeds a genuine envelope through the intake and reports the committed interpretation', async () => {
    queue('users', [{ id: 'sandbox-anna' }], [{ id: 'sandbox-anna' }]);
    queue('slack_messages', [{ state: 'applied', outcome: { reason: 'clear' }, attempts: 1 }]);
    queue('slack_messages', [{ state: 'applied', outcome: { reason: 'clear' } }]);
    queue('status', [
      {
        status: 'IN_LATE',
        fromDate: '2026-09-19',
        toDate: '2026-09-19',
        startsAt: new Date('2026-09-18T22:00:00Z'),
        endsAt: new Date('2026-09-19T08:00:00Z'),
        startsAtApproximate: false,
        endsAtApproximate: true,
        details: 'ish',
      },
    ]);
    enqueue.mockImplementation(async (input) => ({
      outcome: 'queued',
      messageKey: `T_LOCAL:C_LOCAL:${(input as { event: { ts: string } }).event.ts}`,
      revision: (input as { event: { ts: string } }).event.ts,
    }));
    const result = await sendSandboxMessage({
      slackUserId: author,
      text: 'in 10ish',
      announcedAt: '2026-09-19T08:00',
    });
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        team_id: 'T_LOCAL',
        event: expect.objectContaining({ channel: 'C_LOCAL', user: author, text: 'in 10ish' }),
      })
    );
    expect(consume).toHaveBeenCalledWith(result.messageKey, result.messageTs);
    expect(result).toMatchObject({
      intake: { outcome: 'queued' },
      handledBy: 'model',
      announcedAt: '2026-09-19T06:00:00.000Z',
      processing: { kind: 'terminal', state: 'applied', reason: 'clear', attempts: 1 },
      interpretation: {
        decision: 'apply',
        reason: 'clear',
        intervals: [
          {
            status: 'IN_LATE',
            startTime: null,
            endTime: '10:00',
            startApproximate: false,
            endApproximate: true,
            details: 'ish',
          },
        ],
      },
    });
  });
  it('renders a scheduled retry as a normal outcome with the likely reason', async () => {
    queue('users', [], []);
    queue('slack_messages', [{ attempts: 1 }], [{ state: 'pending', outcome: null }]);
    enqueue.mockResolvedValue({ outcome: 'queued', messageKey: 'k', revision: 'r' });
    consume.mockRejectedValue(new SlackMessagePendingError(120));
    await expect(
      sendSandboxMessage({ slackUserId: 'U_LOCAL_UNMAPPED', text: 'wfh' })
    ).resolves.toMatchObject({
      processing: { kind: 'retry_scheduled', afterSeconds: 120, likelyReason: 'unmapped_user' },
      interpretation: null,
    });
  });
  it('surfaces duplicate_or_stale instead of processing', async () => {
    queue('users', [{ id: 'sandbox-anna' }]);
    queue('slack_messages', [{ state: 'applied', outcome: { reason: 'clear' } }]);
    queue('status', []);
    enqueue.mockResolvedValue({ outcome: 'duplicate_or_stale', messageKey: 'k', revision: 'r' });
    await expect(sendSandboxMessage({ slackUserId: author, text: 'wfh' })).resolves.toMatchObject({
      intake: { outcome: 'duplicate_or_stale' },
      processing: { kind: 'not_processed' },
    });
    expect(consume).not.toHaveBeenCalled();
  });
  it('reports an intake rejection without touching the consumer', async () => {
    queue('users', [{ id: 'sandbox-anna' }]);
    enqueue.mockResolvedValue({ outcome: 'ignored', reason: 'wrong_channel' });
    await expect(sendSandboxMessage({ slackUserId: author, text: 'wfh' })).resolves.toMatchObject({
      intake: { outcome: 'ignored', reason: 'wrong_channel' },
      processing: { kind: 'not_processed' },
    });
    expect(consume).not.toHaveBeenCalled();
  });
});

describe('edits and deletions', () => {
  const messageTs = '1789000000.000123';
  it('send message_changed with a newer revision', async () => {
    queue('users', [{ id: 'sandbox-anna' }]);
    queue('slack_messages', [{ state: 'applied', outcome: { reason: 'clear' }, attempts: 1 }]);
    queue('slack_messages', [{ state: 'applied', outcome: { reason: 'clear' } }]);
    queue('status', []);
    enqueue.mockResolvedValue({ outcome: 'queued', messageKey: 'k', revision: 'r' });
    const result = await editSandboxMessage({
      slackUserId: author,
      messageTs,
      text: 'wfh tomorrow',
    });
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          subtype: 'message_changed',
          message: expect.objectContaining({ ts: messageTs, text: 'wfh tomorrow' }),
        }),
      })
    );
    expect(Number(result.revision)).toBeGreaterThan(Number(messageTs));
  });
  it('send message_deleted and run the consumer for the broadcast', async () => {
    queue('users', [{ id: 'sandbox-anna' }]);
    queue('slack_messages', [{ state: 'deleted', outcome: null, attempts: 0 }]);
    queue('slack_messages', [{ state: 'deleted', outcome: null }]);
    enqueue.mockResolvedValue({ outcome: 'deleted', messageKey: 'k', revision: 'r' });
    const result = await deleteSandboxMessage({ slackUserId: author, messageTs });
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({ subtype: 'message_deleted', deleted_ts: messageTs }),
      })
    );
    expect(consume).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      intake: { outcome: 'deleted' },
      processing: { kind: 'terminal', state: 'deleted' },
      interpretation: null,
    });
  });
});
