import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { db, pool } from '@/db';
import { slackMessageFeedback, slackMessages, status, users } from '@/db/schema';

const reviewer = vi.hoisted(() => ({ requireMessageReviewer: vi.fn() }));
vi.mock('@/lib/auth/message-review', () => ({
  requireMessageReviewer: reviewer.requireMessageReviewer,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { saveExpectedStatusAction } from '@/app/actions/messageQualityActions';

const team = `TFEEDBACK_${randomUUID().slice(0, 8)}`;
const channel = 'CFEEDBACK';
const userId = randomUUID();
const messageKey = `${team}:${channel}:1790000000.123456`;
const revision = '1790000000.123456';

describe.runIf(process.env.SLACK_TEST_DATABASE === '1')(
  'expected status feedback action on isolated PostgreSQL',
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
        slackUserId: 'UREVIEWER',
        firstName: 'Review',
        lastName: 'User',
      });
    });

    beforeEach(async () => {
      await db.delete(slackMessages).where(eq(slackMessages.teamId, team));
      await db.insert(slackMessages).values({
        messageKey,
        teamId: team,
        channelId: channel,
        messageTs: revision,
        revision,
        state: 'review',
        convertedToStatus: false,
        outcome: { reason: 'processing_failed', failureReason: 'extraction_failed' },
      });
      reviewer.requireMessageReviewer.mockReset().mockResolvedValue(userId);
    });

    afterAll(async () => {
      await db.delete(slackMessages).where(eq(slackMessages.teamId, team));
      await db.delete(users).where(eq(users.userId, userId));
      vi.unstubAllEnvs();
      await pool.end();
    });

    it('saves and edits one feedback row for the exact message revision', async () => {
      const input = { messageKey, revision, status: 'SICK' as const, note: 'needs sick status' };
      await expect(saveExpectedStatusAction(input)).resolves.toEqual({ ok: true });
      await expect(
        saveExpectedStatusAction({ ...input, status: 'FROM_HOME', note: 'work from home' })
      ).resolves.toEqual({ ok: true });

      const rows = await db
        .select()
        .from(slackMessageFeedback)
        .where(
          and(
            eq(slackMessageFeedback.messageKey, messageKey),
            eq(slackMessageFeedback.revision, revision)
          )
        );
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        preferredStatus: 'FROM_HOME',
        note: 'work from home',
        reviewerUserId: userId,
      });
      await expect(
        db.select().from(status).where(eq(status.sourceMessageKey, messageKey))
      ).resolves.toHaveLength(0);
    });

    it('rejects stale, pending, converted, deleted, and out-of-scope rows', async () => {
      await expect(
        saveExpectedStatusAction({
          messageKey,
          revision: '1790000000.123455',
          status: 'SICK',
          note: '',
        })
      ).resolves.toMatchObject({ ok: false });
      await db
        .update(slackMessages)
        .set({ state: 'pending' })
        .where(eq(slackMessages.messageKey, messageKey));
      await expect(
        saveExpectedStatusAction({ messageKey, revision, status: 'SICK', note: '' })
      ).resolves.toMatchObject({ ok: false });
      await db
        .update(slackMessages)
        .set({ state: 'review' })
        .where(eq(slackMessages.messageKey, messageKey));
      await db
        .update(slackMessages)
        .set({ channelId: 'OTHER_CHANNEL' })
        .where(eq(slackMessages.messageKey, messageKey));
      await expect(
        saveExpectedStatusAction({ messageKey, revision, status: 'SICK', note: '' })
      ).resolves.toMatchObject({ ok: false });
      await db
        .update(slackMessages)
        .set({ channelId: channel })
        .where(eq(slackMessages.messageKey, messageKey));
      await db
        .update(slackMessages)
        .set({ teamId: 'OTHER_TEAM' })
        .where(eq(slackMessages.messageKey, messageKey));
      await expect(
        saveExpectedStatusAction({ messageKey, revision, status: 'SICK', note: '' })
      ).resolves.toMatchObject({ ok: false });
      await db
        .update(slackMessages)
        .set({ teamId: team })
        .where(eq(slackMessages.messageKey, messageKey));
      await db
        .update(slackMessages)
        .set({ convertedToStatus: true })
        .where(eq(slackMessages.messageKey, messageKey));
      await expect(
        saveExpectedStatusAction({ messageKey, revision, status: 'SICK', note: '' })
      ).resolves.toMatchObject({ ok: false });
      await db
        .update(slackMessages)
        .set({ state: 'deleted', convertedToStatus: false })
        .where(eq(slackMessages.messageKey, messageKey));
      await expect(
        saveExpectedStatusAction({ messageKey, revision, status: 'SICK', note: '' })
      ).resolves.toMatchObject({ ok: false });
      await expect(
        db
          .select()
          .from(slackMessageFeedback)
          .where(eq(slackMessageFeedback.messageKey, messageKey))
      ).resolves.toHaveLength(0);
    });

    it('rejects invalid statuses and notes longer than 2000 characters', async () => {
      await expect(
        saveExpectedStatusAction({
          messageKey,
          revision,
          status: 'NOT_A_STATUS' as never,
          note: '',
        })
      ).resolves.toMatchObject({ ok: false });
      await expect(
        saveExpectedStatusAction({ messageKey, revision, status: 'SICK', note: 'x'.repeat(2001) })
      ).resolves.toMatchObject({ ok: false });
      await expect(
        db
          .select()
          .from(slackMessageFeedback)
          .where(eq(slackMessageFeedback.messageKey, messageKey))
      ).resolves.toHaveLength(0);
    });

    it('requires reviewer authorization before accepting a write', async () => {
      reviewer.requireMessageReviewer.mockRejectedValueOnce(new Error('NOT_FOUND'));
      await expect(
        saveExpectedStatusAction({ messageKey, revision, status: 'SICK', note: '' })
      ).rejects.toThrow('NOT_FOUND');
    });
  }
);
