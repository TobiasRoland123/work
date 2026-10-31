import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, pool } from '@/db';
import { slackAiUsage, slackMessageProcessing } from '@/db/schema';
import { getAiCostDashboard } from '@/lib/ai-cost/service';
import { requireMessageReviewer } from '@/lib/auth/message-review';

vi.mock('@/lib/auth/message-review', () => ({ requireMessageReviewer: vi.fn() }));
const team = `TAICOST_${randomUUID().slice(0, 8)}`;
const channel = 'CAICOST';
const now = new Date('2026-10-16T10:00:00Z');

function usage(values: Partial<typeof slackAiUsage.$inferInsert>) {
  return {
    id: randomUUID(),
    messageKey: `${team}:${channel}:1`,
    revision: '1',
    teamId: team,
    channelId: channel,
    model: 'openai/gpt-small',
    state: 'completed',
    ...values,
  };
}

describe.runIf(process.env.SLACK_TEST_DATABASE === '1')('AI cost on isolated PostgreSQL', () => {
  beforeAll(() => {
    if (process.env.PGHOST !== '127.0.0.1' || process.env.PGDATABASE !== 'work_slack_test')
      throw new Error('Dedicated local test database required');
    vi.stubEnv('SLACK_TEAM_ID', team);
    vi.stubEnv('SLACK_CHANNEL_ID', channel);
  });
  beforeEach(async () => {
    await db.delete(slackAiUsage).where(eq(slackAiUsage.teamId, team));
    await db.delete(slackMessageProcessing).where(eq(slackMessageProcessing.teamId, team));
    vi.mocked(requireMessageReviewer).mockReset().mockResolvedValue('reviewer');
  });
  afterAll(async () => {
    await db.delete(slackAiUsage).where(eq(slackAiUsage.teamId, team));
    await db.delete(slackMessageProcessing).where(eq(slackMessageProcessing.teamId, team));
    vi.unstubAllEnvs();
    await pool.end();
  });

  it('denies access before loading any usage', async () => {
    vi.mocked(requireMessageReviewer).mockRejectedValue(new Error('Forbidden'));
    const select = vi.spyOn(db, 'select');
    await expect(getAiCostDashboard({}, now)).rejects.toThrow('Forbidden');
    expect(select).not.toHaveBeenCalled();
    select.mockRestore();
  });

  it('counts tracked unique messages by first handling day and configured channel', async () => {
    const tracked = (id: string, usedAi: boolean, handledAt: string, channelId = channel) => ({
      messageKey: `${team}:${channelId}:${id}`,
      teamId: team,
      channelId,
      usedAi,
      handledAt: new Date(handledAt),
    });
    await db.insert(slackMessageProcessing).values([
      // The Copenhagen start boundary is 22:00 UTC on the previous day.
      tracked('ai', true, '2026-10-09T22:00:00Z'),
      tracked('shorthand', false, '2026-10-15T22:30:00Z'),
      tracked('old', false, '2026-10-09T21:59:59Z'),
      tracked('future', true, '2026-10-16T22:00:00Z'),
      tracked('other-channel', false, '2026-10-14T09:00:00Z', 'OTHER'),
      { ...tracked('other-team', true, '2026-10-14T09:00:00Z'), teamId: `${team}_OTHER` },
    ]);
    // Calls and retries are separate from tracked successful messages.
    await db
      .insert(slackAiUsage)
      .values([
        usage({ startedAt: new Date('2026-10-14T09:00:00Z') }),
        usage({ startedAt: new Date('2026-10-14T09:01:00Z'), state: 'failed' }),
        usage({ startedAt: new Date('2026-10-14T09:02:00Z') }),
      ]);
    const data = await getAiCostDashboard({ days: '7' }, now);
    expect(data.messages).toEqual({ ai: 1, withoutAi: 1, total: 2 });
    expect(data.totals.calls).toBe(3);
    await db
      .delete(slackMessageProcessing)
      .where(eq(slackMessageProcessing.teamId, `${team}_OTHER`));
  });

  it('classifies later AI attempts without moving or recounting the message', async () => {
    const messageKey = `${team}:${channel}:later-edit`;
    await db.insert(slackMessageProcessing).values({
      messageKey,
      teamId: team,
      channelId: channel,
      usedAi: false,
      handledAt: new Date('2026-10-14T09:00:00Z'),
    });
    await db.insert(slackAiUsage).values(
      usage({
        messageKey,
        revision: '2',
        state: 'failed',
        startedAt: new Date('2026-10-16T09:00:00Z'),
      })
    );
    expect((await getAiCostDashboard({ days: '7' }, now)).messages).toEqual({
      ai: 1,
      withoutAi: 0,
      total: 1,
    });
  });

  it('does not infer historical handling from AI calls or invent non-AI counts', async () => {
    await db.insert(slackAiUsage).values(usage({ startedAt: new Date('2026-10-14T09:00:00Z') }));
    expect((await getAiCostDashboard({ days: '7' }, now)).messages).toEqual({
      ai: 0,
      withoutAi: 0,
      total: 0,
    });
  });

  it('totals the period by Copenhagen day and model, scoped to the channel', async () => {
    await db.insert(slackAiUsage).values([
      usage({
        costUsd: '0.002',
        inputTokens: 1000,
        outputTokens: 50,
        // 00:30 on 16 October in Copenhagen, still 15 October in UTC.
        startedAt: new Date('2026-10-15T22:30:00Z'),
      }),
      usage({
        costUsd: '0.001',
        inputTokens: 400,
        outputTokens: 20,
        startedAt: new Date('2026-10-14T09:00:00Z'),
      }),
      usage({
        model: 'openai/gpt-large',
        costUsd: null,
        state: 'failed',
        startedAt: new Date('2026-10-14T09:05:00Z'),
      }),
      // Outside the 7-day period, inside the previous month.
      usage({ costUsd: '0.004', startedAt: new Date('2026-09-20T09:00:00Z') }),
      usage({ channelId: 'OTHER', costUsd: '9', startedAt: new Date('2026-10-14T09:00:00Z') }),
    ]);

    const data = await getAiCostDashboard({ days: '7' }, now);
    expect(data.startDate).toBe('2026-10-10');
    expect(data.endDate).toBe('2026-10-16');
    expect(data.daily).toHaveLength(7);
    expect(data.totals).toMatchObject({
      calls: 3,
      unpricedCalls: 1,
      failedCalls: 1,
      inputTokens: 1400,
      outputTokens: 70,
    });
    expect(data.totals.costUsd).toBeCloseTo(0.003);
    expect(data.daily.find((day) => day.date === '2026-10-16')?.costUsd).toBeCloseTo(0.002);
    expect(data.daily.find((day) => day.date === '2026-10-15')?.calls).toBe(0);
    expect(data.models.map((model) => model.model)).toEqual([
      'openai/gpt-small',
      'openai/gpt-large',
    ]);
    expect(data.currentMonth.calls).toBe(3);
    expect(data.previousMonth).toMatchObject({ start: '2026-09-01', calls: 1 });
    expect(data.previousMonth.costUsd).toBeCloseTo(0.004);
  });
});
