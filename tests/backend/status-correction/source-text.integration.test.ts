import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, pool } from '@/db';
import { slackMessages, statusCorrections, users } from '@/db/schema';

const slack = vi.hoisted(() => ({ getSlackMessage: vi.fn() }));
vi.mock('@/lib/slack/client', () => ({ getSlackMessage: slack.getSlackMessage }));

import { recordCorrectionSourceText } from '@/lib/status/correction-text';
import { enqueueSlackEvent } from '@/lib/slack/inbox';

const team = 'TTEXT_' + randomUUID().slice(0, 8);
const channel = 'CTEXT';
const userId = randomUUID();
const ts = '1790000000.123456';
const edited = '1790000300.000001';
const messageKey = team + ':' + channel + ':' + ts;
let correctionId: number;

const stored = async () =>
  (
    await db
      .select({ sourceText: statusCorrections.sourceText })
      .from(statusCorrections)
      .where(eq(statusCorrections.id, correctionId))
  )[0]?.sourceText;

describe.runIf(process.env.SLACK_TEST_DATABASE === '1')(
  'correction message text on isolated PostgreSQL',
  () => {
    beforeAll(async () => {
      if (process.env.PGHOST !== '127.0.0.1' || process.env.PGDATABASE !== 'work_slack_test')
        throw new Error('Dedicated local test database required');
      vi.stubEnv('SLACK_TEAM_ID', team);
      vi.stubEnv('SLACK_CHANNEL_ID', channel);
      await db.insert(users).values({ userId, email: userId + '@example.com', slackTeamId: team });
    });

    beforeEach(async () => {
      await db.delete(statusCorrections).where(eq(statusCorrections.userId, userId));
      const [row] = await db
        .insert(statusCorrections)
        .values({
          userId,
          sourceMessageKey: messageKey,
          sourceRevision: ts,
          originalStatus: 'FROM_HOME',
          correctedStatus: 'SICK',
          fromDate: '2026-09-22',
          toDate: '2026-09-22',
        })
        .returning({ id: statusCorrections.id });
      correctionId = row.id;
      slack.getSlackMessage.mockReset();
    });

    afterAll(async () => {
      await db.delete(statusCorrections).where(eq(statusCorrections.userId, userId));
      await db.delete(slackMessages).where(eq(slackMessages.teamId, team));
      await db.delete(users).where(eq(users.userId, userId));
      vi.unstubAllEnvs();
      await pool.end();
    });

    it('stores the text of the exact corrected revision once', async () => {
      slack.getSlackMessage.mockResolvedValue({ ts, text: 'hjemme, syg' });
      await expect(recordCorrectionSourceText(correctionId)).resolves.toBe(true);
      expect(slack.getSlackMessage).toHaveBeenCalledWith(channel, ts);
      await expect(stored()).resolves.toBe('hjemme, syg');

      // A repeated correction does not contact Slack again.
      await expect(recordCorrectionSourceText(correctionId)).resolves.toBe(false);
      expect(slack.getSlackMessage).toHaveBeenCalledTimes(1);
    });

    it('does not store text from another revision or a missing message', async () => {
      slack.getSlackMessage.mockResolvedValueOnce({ ts, text: 'syg', edited: { ts: edited } });
      await expect(recordCorrectionSourceText(correctionId)).resolves.toBe(false);
      slack.getSlackMessage.mockResolvedValueOnce(null);
      await expect(recordCorrectionSourceText(correctionId)).resolves.toBe(false);
      await expect(stored()).resolves.toBeNull();
    });

    it('keeps the correction when Slack fails or the revision is unknown', async () => {
      slack.getSlackMessage.mockRejectedValueOnce(new Error('ratelimited'));
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await expect(recordCorrectionSourceText(correctionId)).resolves.toBe(false);
      warn.mockRestore();

      await db
        .update(statusCorrections)
        .set({ sourceRevision: null })
        .where(eq(statusCorrections.id, correctionId));
      await expect(recordCorrectionSourceText(correctionId)).resolves.toBe(false);
      expect(slack.getSlackMessage).toHaveBeenCalledTimes(1);
      await expect(stored()).resolves.toBeNull();
    });

    it('clears the text but keeps the record when the message is deleted in Slack', async () => {
      await db
        .update(statusCorrections)
        .set({ sourceText: 'hjemme, syg' })
        .where(eq(statusCorrections.id, correctionId));
      await expect(
        enqueueSlackEvent({
          type: 'event_callback',
          team_id: team,
          event_id: 'EvDelete',
          event: {
            type: 'message',
            channel,
            subtype: 'message_deleted',
            deleted_ts: ts,
            event_ts: '1790000600.000001',
            previous_message: { ts, user: 'UAUTHOR' },
          },
        })
      ).resolves.toMatchObject({ outcome: 'deleted' });
      await expect(stored()).resolves.toBeNull();
    });
  }
);
