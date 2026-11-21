import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { historicalUsageObserver } from '@/lib/slack/history/billing';

const key = Symbol.for('work.slack.history.verifiedGatewayReceipt.v1');
const globals = globalThis as typeof globalThis & { [key]?: unknown };
const model = 'openai/gpt-6-luna';
const generation = 'gen_test12345678';
const usage = {
  state: 'completed' as const,
  costUsd: '0.00022',
  inputTokens: 30,
  outputTokens: 5,
  responseId: generation,
};
afterEach(() => {
  delete globals[key];
});

function make(receipts: boolean) {
  const query = vi.fn().mockResolvedValue({ rowCount: 1 });
  const paused = vi.fn();
  const observer = historicalUsageObserver(
    { query } as unknown as PoolClient,
    {
      model,
      maxRequestUsd: 0.6,
      budgetUsd: 20,
      ...(receipts ? { receiptAccounting: 'verified-gateway-v1' as const } : {}),
    },
    'run',
    'message',
    paused
  );
  return { query, paused, observer };
}
describe('historical request accounting', () => {
  it('requires the frozen receipt mode’s verifier before reserving or dispatching', async () => {
    const { query, observer } = make(true);
    await expect(observer.onStart(model)).rejects.toThrow('guard required');
    expect(query).not.toHaveBeenCalled();
  });
  it('keeps the legacy reservation despite a lower price reported in the completion', async () => {
    const { query, observer, paused } = make(false);
    await observer.onStart(model);
    await observer.onFinish(usage);
    expect(query).toHaveBeenCalledTimes(1);
    expect(paused).not.toHaveBeenCalled();
  });
  it('credits only one verified receipt to this item and run', async () => {
    const reader = vi.fn().mockResolvedValue(221);
    globals[key] = reader;
    const { query, observer, paused } = make(true);
    await observer.onStart(model);
    await observer.onFinish(usage);
    expect(reader).toHaveBeenCalledWith('run', generation, model);
    expect(query.mock.calls.map((call) => call[1])).toEqual([
      ['run', 'message', '0.6', false, true, 20],
      ['run', 'message', '-0.599779', false, false, 20],
    ]);
    await expect(observer.onFinish(usage)).rejects.toThrow('reservation');
    expect(paused).not.toHaveBeenCalled();
  });
  it.each([null, -1, NaN, 0.2])('keeps and pauses for unverified receipt %s', async (value) => {
    globals[key] = async () => value;
    const { query, observer, paused } = make(true);
    await observer.onStart(model);
    await observer.onFinish(usage);
    expect(query.mock.calls[1][1]).toEqual(['run', 'message', '0', true, false, 20]);
    expect(paused).toHaveBeenCalledOnce();
  });
  it('retains the hold on failed or unidentified requests', async () => {
    const reader = vi.fn();
    globals[key] = reader;
    const { query, observer } = make(true);
    await observer.onStart(model);
    await observer.onFinish({ ...usage, state: 'failed', responseId: null });
    expect(reader).not.toHaveBeenCalled();
    expect(query.mock.calls[1][1][2]).toBe('0');
  });
  it('records overrun and pauses the run', async () => {
    globals[key] = async () => 700000;
    const { query, observer, paused } = make(true);
    await observer.onStart(model);
    await expect(observer.onFinish(usage)).rejects.toThrow('exceeded reservation');
    expect(Number(query.mock.calls[1][1][2])).toBeCloseTo(0.1);
    expect(paused).toHaveBeenCalledOnce();
  });
  it('stops on a failed budget reservation', async () => {
    const { query, observer } = make(false);
    query.mockResolvedValueOnce({ rowCount: 0 });
    await expect(observer.onStart(model)).rejects.toThrow('budget exhausted');
    await expect(observer.onFinish(usage)).rejects.toThrow('reservation');
  });
});
