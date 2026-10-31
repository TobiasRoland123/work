import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  returning: vi.fn(),
  select: vi.fn(),
  invalidate: vi.fn(),
  send: vi.fn(),
  extract: vi.fn(),
}));
vi.mock('@/db', () => {
  const query = {
    set: () => query,
    where: () => query,
    values: () => query,
    onConflictDoUpdate: () => query,
    returning: mocks.returning,
    then: (resolve: (rows: unknown[]) => unknown) => Promise.resolve([]).then(resolve),
  };
  const select = {
    from: () => select,
    where: () => select,
    limit: mocks.select,
    then: (resolve: (rows: unknown[]) => unknown) => Promise.resolve(mocks.select()).then(resolve),
  };
  return {
    db: { transaction: mocks.transaction, update: () => query, select: () => select },
    tx: { insert: () => query, delete: () => query, update: () => query },
  };
});
vi.mock('next/cache', () => ({ revalidateTag: mocks.invalidate }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: { channel: () => ({ send: mocks.send }) } }));
vi.mock('@/lib/slack/extraction', () => ({
  extractAttendance: mocks.extract,
  statusRows: () => [{ status: 'REMOTE' }],
  descriptionRows: () => [],
}));
vi.mock('@/lib/slack/learned-shorthand', () => ({
  readLearnedShorthand: async () => ({}),
  templateFromExtraction: () => null,
}));
import { enqueueSlackEvent, processSlackInbox, processQueuedSlackMessage } from '@/lib/slack/inbox';

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('SLACK_TEAM_ID', 'TTEST');
  vi.stubEnv('SLACK_CHANNEL_ID', 'CTEST');
});
afterEach(() => vi.unstubAllEnvs());
const job = {
  messageKey: 'key',
  teamId: 'TTEST',
  channelId: 'CTEST',
  slackUserId: 'user',
  messageTs: '1788766200.000001',
  revision: '1788766500.000001',
  text: 'remote today',
  attempts: 0,
};
const deletion = {
  type: 'event_callback',
  team_id: 'TTEST',
  event_id: 'Ev-delete',
  event: {
    type: 'message',
    subtype: 'message_deleted',
    channel: 'CTEST',
    ts: '1788766500.000001',
    deleted_ts: '1788766200.000001',
  },
};

describe('Slack board cache invalidation', () => {
  it.each([0, 2])(
    'invalidates committed imports/edits before broadcast, including retry attempt %s',
    async (attempts) => {
      mocks.transaction
        .mockResolvedValueOnce({ ...job, attempts })
        .mockImplementationOnce(async () => {
          expect(mocks.invalidate).not.toHaveBeenCalled();
          return true;
        });
      mocks.select.mockResolvedValueOnce([{ id: 'person' }]);
      mocks.extract.mockResolvedValueOnce({ decision: 'apply', reason: 'clear' });
      mocks.send.mockImplementationOnce(async () =>
        expect(mocks.invalidate).toHaveBeenCalledWith('week-overview')
      );
      const result = await processSlackInbox(1);
      expect(result.applied).toBe(1);
      expect(mocks.invalidate).toHaveBeenCalledTimes(1);
      expect(mocks.send).toHaveBeenCalledTimes(1);
    }
  );
  it('does not invalidate or broadcast an import whose transaction failed', async () => {
    mocks.transaction.mockResolvedValueOnce(job).mockRejectedValueOnce(new Error('rollback'));
    mocks.select.mockResolvedValueOnce([{ id: 'person' }]);
    mocks.extract.mockResolvedValueOnce({ decision: 'apply', reason: 'clear' });
    expect((await processSlackInbox(1)).retried).toBe(1);
    expect(mocks.invalidate).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it.each([true, false])(
    'invalidates only accepted deletions that removed statuses: %s',
    async (removed) => {
      const { tx } = (await import('@/db')) as unknown as { tx: unknown };
      mocks.returning
        .mockResolvedValueOnce([{ key: 'key' }])
        .mockResolvedValueOnce(removed ? [{ id: 1 }] : []);
      mocks.transaction.mockImplementationOnce(async (callback) => {
        const result = await callback(tx);
        expect(mocks.invalidate).not.toHaveBeenCalled();
        return result;
      });
      expect((await enqueueSlackEvent(deletion)).outcome).toBe('deleted');
      expect(mocks.invalidate).toHaveBeenCalledTimes(removed ? 1 : 0);
    }
  );
  it.each(['deleted', 'applied'])(
    'invalidates and broadcasts terminal %s queue retries',
    async (state) => {
      mocks.transaction.mockResolvedValueOnce(null);
      mocks.select.mockResolvedValueOnce([{ state, revision: job.revision }]);
      mocks.send.mockImplementationOnce(async () =>
        expect(mocks.invalidate).toHaveBeenCalledWith('week-overview')
      );
      await processQueuedSlackMessage(job.messageKey, job.revision);
      expect(mocks.invalidate).toHaveBeenCalledTimes(1);
      expect(mocks.send).toHaveBeenCalledTimes(1);
    }
  );
  it('does not invalidate a rolled back deletion', async () => {
    mocks.transaction.mockRejectedValueOnce(new Error('rollback'));
    await expect(enqueueSlackEvent(deletion)).rejects.toThrow('rollback');
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });
});
