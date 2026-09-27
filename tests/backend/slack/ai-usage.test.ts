import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSlackAiUsageRecorder } from '@/lib/slack/ai-usage';

const writes = vi.hoisted(() => ({
  insert: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    insert: () => ({ values: writes.insert }),
    update: () => ({
      set: (values: unknown) => {
        writes.set(values);
        return { where: writes.update };
      },
    }),
  },
}));

const identity = {
  messageKey: 'T:C:1.000001',
  revision: '1.000001',
  teamId: 'T',
  channelId: 'C',
};

describe('Slack AI usage recorder', () => {
  beforeEach(() => {
    writes.insert.mockReset().mockResolvedValue(undefined);
    writes.set.mockReset();
    writes.update.mockReset().mockResolvedValue(undefined);
  });

  it('inserts an attempt before completion and leaves unknown cost as null', async () => {
    const recorder = createSlackAiUsageRecorder(identity);
    await recorder.onStart('provider/model');
    expect(writes.insert).toHaveBeenCalledWith(
      expect.objectContaining({ ...identity, model: 'provider/model', id: expect.any(String) })
    );
    expect(writes.update).not.toHaveBeenCalled();
    await recorder.onFinish({
      state: 'failed',
      costUsd: null,
      inputTokens: null,
      outputTokens: null,
      responseId: null,
    });
    expect(writes.update).toHaveBeenCalledOnce();
    expect(writes.set).toHaveBeenCalledWith({
      state: 'failed',
      completedAt: expect.any(Date),
      costUsd: null,
      inputTokens: null,
      outputTokens: null,
      responseId: null,
    });
    const [inserted] = writes.insert.mock.calls[0];
    expect(inserted).not.toHaveProperty('text');
    expect(inserted).not.toHaveProperty('prompt');
    expect(inserted).not.toHaveProperty('output');
  });

  it('blocks the AI call if the starting row cannot be stored', async () => {
    writes.insert.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(createSlackAiUsageRecorder(identity).onStart('provider/model')).rejects.toThrow(
      'database unavailable'
    );
  });

  it('creates a separate row for each paid attempt of the same message revision', async () => {
    const first = createSlackAiUsageRecorder(identity);
    const retry = createSlackAiUsageRecorder(identity);
    await first.onStart('provider/model');
    await retry.onStart('provider/model');
    const firstRow = writes.insert.mock.calls[0][0];
    const retryRow = writes.insert.mock.calls[1][0];
    expect(firstRow).toMatchObject(identity);
    expect(retryRow).toMatchObject(identity);
    expect(firstRow.id).not.toBe(retryRow.id);
  });

  it('keeps the started row when final usage cannot be stored', async () => {
    writes.update.mockRejectedValueOnce(new Error('database unavailable'));
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const recorder = createSlackAiUsageRecorder(identity);
      await recorder.onStart('provider/model');
      await expect(
        recorder.onFinish({
          state: 'completed',
          costUsd: '0.000012345678',
          inputTokens: 20,
          outputTokens: 7,
          responseId: 'response-1',
        })
      ).resolves.toBeUndefined();
      expect(warning).toHaveBeenCalledWith('slack_ai_usage_finish_failed', {
        attemptId: expect.any(String),
      });
    } finally {
      warning.mockRestore();
    }
  });
});
