import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, pool } from '@/db';
import { slackAiUsage, slackMessageFeedback, slackMessages, status, users } from '@/db/schema';
import { getMessageQualityDashboard } from '@/lib/message-quality/service';
import { requireMessageReviewer } from '@/lib/auth/message-review';

vi.mock('@/lib/auth/message-review', () => ({ requireMessageReviewer: vi.fn() }));
const team = `TQUALITY_${randomUUID().slice(0, 8)}`;
const userId = randomUUID();
const channel = 'CQUALITY';
const now = new Date('2026-09-27T12:00:00Z');

function message(index: number, values: Partial<typeof slackMessages.$inferInsert> = {}) {
  const ts = String(new Date('2026-09-21T10:00:00Z').getTime() / 1000 + index);
  return {
    messageKey: `${team}:${channel}:${ts}`,
    teamId: team,
    channelId: channel,
    slackUserId: 'UAUTHOR',
    messageTs: ts,
    revision: ts,
    state: 'applied',
    outcome: { reason: 'uncertain_status' },
    convertedToStatus: false,
    reviewText: `not feeling well ${index}`,
    ...values,
  };
}

describe.runIf(process.env.SLACK_TEST_DATABASE === '1')(
  'message quality on isolated PostgreSQL',
  () => {
    beforeAll(async () => {
      if (process.env.PGHOST !== '127.0.0.1' || process.env.PGDATABASE !== 'work_slack_test')
        throw new Error('Dedicated local test database required');
      vi.stubEnv('SLACK_TEAM_ID', team);
      vi.stubEnv('SLACK_CHANNEL_ID', channel);
      await db.insert(users).values({
        userId,
        email: `${userId}@example.com`,
        slackTeamId: team,
        slackUserId: 'UAUTHOR',
        firstName: 'Quality',
        lastName: 'Author',
      });
    });
    beforeEach(async () => {
      await db.delete(slackAiUsage).where(eq(slackAiUsage.teamId, team));
      await db.delete(status).where(eq(status.userID, userId));
      await db.delete(slackMessages).where(eq(slackMessages.teamId, team));
      vi.mocked(requireMessageReviewer).mockReset().mockResolvedValue(userId);
    });
    afterAll(async () => {
      await db.delete(slackAiUsage).where(eq(slackAiUsage.teamId, team));
      await db.delete(slackMessages).where(eq(slackMessages.teamId, team));
      await db.delete(users).where(eq(users.userId, userId));
      vi.unstubAllEnvs();
      await pool.end();
    });

    it('denies access before loading any dashboard records', async () => {
      vi.mocked(requireMessageReviewer).mockRejectedValue(new Error('Forbidden'));
      const select = vi.spyOn(db, 'select');
      await expect(getMessageQualityDashboard({}, now)).rejects.toThrow('Forbidden');
      expect(select).not.toHaveBeenCalled();
      select.mockRestore();
    });

    it('counts real conversions, description-only outcomes and pending separately, scoped to the channel', async () => {
      await db
        .insert(slackMessages)
        .values([
          message(1, { convertedToStatus: true, outcome: { reason: 'clear' }, reviewText: null }),
          message(2),
          message(3, { state: 'pending', convertedToStatus: null, outcome: null }),
          message(4, { state: 'deleted', convertedToStatus: null }),
          message(5, { channelId: 'OTHER_CHANNEL' }),
        ]);
      const result = await getMessageQualityDashboard({}, now);
      expect(result.selectedSummary).toEqual({
        weekStart: '2026-09-21',
        total: 3,
        converted: 1,
        unconverted: 1,
        pending: 1,
        unknown: 0,
        percentage: 33.3,
        aiCost: { costUsd: null, calls: 0, unpricedCalls: 0 },
      });
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toMatchObject({
        author: 'Quality Author',
        text: 'not feeling well 2',
        reason: 'uncertain_status',
        state: 'applied',
      });
      expect(result.weeks).toHaveLength(12);
      expect(result.weeks[1].percentage).toBeNull();
    });

    it('uses original message week and never counts retained statuses after an uncertain edit', async () => {
      const entry = message(1, {
        state: 'review',
        revision: '1790856000',
        outcome: { reason: 'uncertain_date' },
      });
      await db.insert(slackMessages).values(entry);
      await db
        .insert(status)
        .values({ userID: userId, status: 'FROM_HOME', sourceMessageKey: entry.messageKey });
      const result = await getMessageQualityDashboard({}, now);
      expect(result.selectedSummary).toMatchObject({ total: 1, converted: 0, percentage: 0 });
      expect(result.messages[0].reason).toBe('uncertain_date');
    });

    it('shows only expected status feedback for the exact current revision', async () => {
      const entry = message(1, { revision: '1790000000.000002' });
      await db.insert(slackMessages).values(entry);
      await db.insert(slackMessageFeedback).values([
        {
          messageKey: entry.messageKey,
          revision: '1790000000.000001',
          preferredStatus: 'SICK',
          note: 'old revision',
          reviewerUserId: userId,
        },
        {
          messageKey: entry.messageKey,
          revision: entry.revision,
          preferredStatus: 'FROM_HOME',
          note: 'work from home',
          reviewerUserId: userId,
        },
      ]);

      const result = await getMessageQualityDashboard({}, now);
      expect(result.messages[0]).toMatchObject({
        expectedStatus: 'FROM_HOME',
        expectedStatusNote: 'work from home',
      });
    });

    it('handles legacy records without inventing missing original text', async () => {
      await db
        .insert(slackMessages)
        .values([
          message(1, { convertedToStatus: null, outcome: { reason: 'clear' }, reviewText: null }),
          message(2, { convertedToStatus: null, reviewText: null }),
          message(3, { state: 'review', convertedToStatus: null, outcome: null, reviewText: null }),
        ]);
      const result = await getMessageQualityDashboard({}, now);
      expect(result.selectedSummary).toMatchObject({
        total: 3,
        converted: 1,
        unconverted: 1,
        unknown: 1,
      });
      expect(result.messages.map((row) => row.text)).toEqual([null, null]);
      expect(result.reasons).toEqual(['not_recorded', 'uncertain_status']);
    });

    it('filters and paginates unconverted messages without altering weekly totals', async () => {
      await db.insert(slackMessages).values([
        ...Array.from({ length: 27 }, (_, index) => message(index)),
        message(30, {
          state: 'review',
          outcome: { reason: 'processing_failed', failureReason: 'extraction_failed' },
        }),
      ]);
      const page = await getMessageQualityDashboard({ page: '2' }, now);
      expect(page.messages).toHaveLength(3);
      expect(page.totalPages).toBe(2);
      const filtered = await getMessageQualityDashboard(
        { reason: 'processing_failed', page: '999' },
        now
      );
      expect(filtered.page).toBe(1);
      expect(filtered.messages[0].failureReason).toBe('extraction_failed');
      expect(filtered.totalMessages).toBe(1);
      expect(filtered.selectedSummary.total).toBe(28);
    });

    it('places Sunday night UTC messages in Monday Copenhagen week across DST', async () => {
      await db
        .insert(slackMessages)
        .values([
          message(1, { messageTs: String(new Date('2026-10-25T22:59:59Z').getTime() / 1000) }),
          message(2, { messageTs: String(new Date('2026-10-25T23:00:00Z').getTime() / 1000) }),
        ]);
      const result = await getMessageQualityDashboard(
        { week: '2026-10-26' },
        new Date('2026-10-27T12:00:00Z')
      );
      expect(result.selectedSummary.total).toBe(1);
      expect(result.weeks[1]).toMatchObject({ weekStart: '2026-10-19', total: 1 });
    });

    it('totals billed requests independently of message deletion, revisions and outcome filters', async () => {
      const base = {
        messageKey: 'deleted-message',
        revision: 'old-revision',
        teamId: team,
        channelId: channel,
        model: 'synthetic-model',
      };
      await db.insert(slackAiUsage).values([
        {
          ...base,
          id: randomUUID(),
          costUsd: '0.00125',
          startedAt: new Date('2026-09-21T08:00:00Z'),
          state: 'completed',
        },
        {
          ...base,
          id: randomUUID(),
          costUsd: '0.00275',
          startedAt: new Date('2026-09-22T08:00:00Z'),
          state: 'completed',
        },
        {
          ...base,
          id: randomUUID(),
          costUsd: null,
          startedAt: new Date('2026-09-22T08:01:00Z'),
          state: 'failed',
        },
        {
          ...base,
          id: randomUUID(),
          channelId: 'OTHER',
          costUsd: '10',
          startedAt: new Date('2026-09-22T08:00:00Z'),
        },
      ]);
      const result = await getMessageQualityDashboard({ reason: 'uncertain_status' }, now);
      expect(result.selectedSummary).toMatchObject({
        total: 0,
        aiCost: { costUsd: 0.004, calls: 3, unpricedCalls: 1 },
      });
      expect(result.dailyCosts).toHaveLength(7);
      expect(result.dailyCosts[0]).toEqual({
        date: '2026-09-21',
        costUsd: 0.00125,
        calls: 1,
        unpricedCalls: 0,
      });
      expect(result.dailyCosts[1]).toEqual({
        date: '2026-09-22',
        costUsd: 0.00275,
        calls: 2,
        unpricedCalls: 1,
      });
      expect(result.dailyCosts[2]).toEqual({
        date: '2026-09-23',
        costUsd: null,
        calls: 0,
        unpricedCalls: 0,
      });
    });

    it('groups spend by request date in Copenhagen and keeps entirely unknown costs null', async () => {
      const base = {
        messageKey: 'backdated-message',
        revision: 'earlier-revision',
        teamId: team,
        channelId: channel,
        model: 'synthetic-model',
      };
      await db.insert(slackAiUsage).values([
        {
          ...base,
          id: randomUUID(),
          costUsd: null,
          startedAt: new Date('2026-10-25T22:59:59Z'),
          state: 'failed',
        },
        {
          ...base,
          id: randomUUID(),
          costUsd: '0.000008',
          startedAt: new Date('2026-10-25T23:00:00Z'),
          state: 'completed',
        },
      ]);
      const result = await getMessageQualityDashboard(
        { week: '2026-10-26' },
        new Date('2026-10-27T12:00:00Z')
      );
      expect(result.selectedSummary.aiCost).toEqual({
        costUsd: 0.000008,
        calls: 1,
        unpricedCalls: 0,
      });
      expect(result.dailyCosts[0].date).toBe('2026-10-26');
      expect(result.dailyCosts[0].costUsd).toBe(0.000008);
      expect(result.weeks[1].aiCost).toEqual({ costUsd: null, calls: 1, unpricedCalls: 1 });
    });
  }
);
