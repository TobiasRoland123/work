import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, pool } from '@/db';
import { shorthandObservations, slackMessages, status, users } from '@/db/schema';
import { enqueueSlackEvent, processSlackInbox } from '@/lib/slack/inbox';
import { extractAttendance, type Extraction } from '@/lib/slack/extraction';
import { loadAttendanceContext } from '@/lib/slack/attendance-context';
import { statusService } from '@/lib/services/statusService';

vi.mock('@/lib/supabaseClient', () => ({ supabase: null }));
vi.mock('@/lib/slack/extraction', async (original) => ({
  ...(await original<typeof import('@/lib/slack/extraction')>()),
  extractAttendance: vi.fn(),
}));
const team = 'TCONTEXT',
  channel = 'CCONTEXT',
  author = 'UCONTEXT',
  userId = randomUUID();
const ts = (minute: number) =>
  `${Date.parse(`2026-09-07T08:${String(minute).padStart(2, '0')}:00Z`) / 1000}.000001`;
const key = (minute: number) => `${team}:${channel}:${ts(minute)}`;
const envelope = (minute: number, text: string) => ({
  type: 'event_callback',
  team_id: team,
  event_id: `ctx${minute}`,
  event: { type: 'message', channel, user: author, ts: ts(minute), text },
});
const arrival = (hour: string, day = '2026-09-07'): Extraction => ({
  decision: 'apply',
  reason: 'clear',
  intervals: [
    {
      status: 'IN_LATE',
      fromDate: day,
      toDate: day,
      startTime: null,
      endTime: `${hour}:00`,
      startApproximate: false,
      endApproximate: false,
      comment: null,
    },
    {
      status: 'IN_OFFICE',
      fromDate: day,
      toDate: day,
      startTime: `${hour}:00`,
      endTime: null,
      startApproximate: false,
      endApproximate: false,
      comment: null,
    },
  ],
});
async function processMessage(minute: number) {
  await db
    .update(slackMessages)
    .set({ nextAttemptAt: new Date(0) })
    .where(eq(slackMessages.messageKey, key(minute)));
  return processSlackInbox(1, key(minute));
}
async function send(minute: number, text: string, result: Extraction) {
  vi.mocked(extractAttendance).mockResolvedValueOnce(result);
  await enqueueSlackEvent(envelope(minute, text));
  return processMessage(minute);
}
async function remove(minute: number, revision: number) {
  await enqueueSlackEvent({
    ...envelope(minute, ''),
    event: {
      type: 'message',
      subtype: 'message_deleted',
      channel,
      deleted_ts: ts(minute),
      event_ts: ts(revision),
    },
  });
}
async function edit(minute: number, revision: number, text: string, result: Extraction) {
  vi.mocked(extractAttendance).mockResolvedValueOnce(result);
  await enqueueSlackEvent({
    ...envelope(minute, text),
    event: {
      type: 'message',
      subtype: 'message_changed',
      channel,
      event_ts: ts(revision),
      message: { ...envelope(minute, text).event, edited: { ts: ts(revision) } },
    },
  });
  return processMessage(minute);
}
const visible = () => statusService.getStatusByUserUserId(userId);

describe.runIf(process.env.SLACK_TEST_DATABASE === '1')(
  'contextual Slack corrections on isolated PostgreSQL',
  () => {
    beforeAll(async () => {
      if (process.env.PGHOST !== '127.0.0.1' || process.env.PGDATABASE !== 'work_slack_test')
        throw new Error('Dedicated local test database required');
      vi.stubEnv('SLACK_TEAM_ID', team);
      vi.stubEnv('SLACK_CHANNEL_ID', channel);
      await db
        .insert(users)
        .values({ userId, email: `${userId}@example.com`, slackTeamId: team, slackUserId: author });
    });
    beforeEach(async () => {
      await db.delete(status).where(eq(status.userID, userId));
      await db.delete(slackMessages).where(eq(slackMessages.teamId, team));
      vi.mocked(extractAttendance).mockReset();
    });
    afterAll(async () => {
      await db.delete(slackMessages).where(eq(slackMessages.teamId, team));
      await db.delete(users).where(eq(users.userId, userId));
      vi.unstubAllEnvs();
      await pool.end();
    });
    it('uses prior intervals, replaces only the targeted announcement, and restores it on deletion', async () => {
      await send(1, 'In at 10', arrival('10'));
      await send(2, 'Vacation next week', {
        decision: 'apply',
        reason: 'clear',
        intervals: [
          {
            ...arrival('10').intervals[0],
            status: 'VACATION',
            fromDate: '2026-09-14',
            toDate: '2026-09-18',
            endTime: null,
          },
        ],
      });
      await send(3, 'Actually make that 11', { ...arrival('11'), replaces: ['prior_1'] });
      const context = vi.mocked(extractAttendance).mock.calls[2][3]!;
      expect(context).toHaveLength(2);
      expect(context[0]).toMatchObject({
        text: null,
        replaceable: true,
        intervals: [{ endTime: '10:00' }, { startTime: '10:00' }],
      });
      expect(context[1].replaceable).toBe(false);
      expect((await visible()).map((row) => row.sourceMessageKey)).toEqual([
        key(2),
        key(3),
        key(3),
      ]);
      expect(await db.select().from(status).where(eq(status.userID, userId))).toHaveLength(5);
      expect(
        await db
          .select()
          .from(shorthandObservations)
          .where(eq(shorthandObservations.messageKey, key(3)))
      ).toHaveLength(0);
      await remove(3, 4);
      expect((await visible()).map((row) => row.sourceMessageKey)).toEqual([
        key(1),
        key(1),
        key(2),
      ]);
    });
    it('reinterprets an edited correction with its original antecedent and releases links on a standalone edit', async () => {
      await send(1, 'In at 10', arrival('10'));
      await send(2, 'Actually 11', { ...arrival('11'), replaces: ['prior_1'] });
      await edit(2, 3, 'Actually 12', { ...arrival('12'), replaces: ['prior_1'] });
      expect(vi.mocked(extractAttendance).mock.calls[2][3]?.[0].intervals[0].endTime).toBe('10:00');
      expect(await visible()).toHaveLength(2);
      await edit(2, 4, 'In at 12 tomorrow', arrival('12', '2026-09-08'));
      expect(await visible()).toHaveLength(4);
    });
    it('supports moving a one-day announcement without reviving its original date', async () => {
      await send(1, 'In at 10 today', arrival('10'));
      await send(2, 'Actually tomorrow', { ...arrival('10', '2026-09-08'), replaces: ['prior_1'] });
      expect((await visible()).every((row) => row.fromDate === '2026-09-08')).toBe(true);
    });
    it('keeps known attendance when the contextual follow-up is uncertain or references an unknown source', async () => {
      await send(1, 'In at 10', arrival('10'));
      await send(2, 'Never mind?', {
        decision: 'review',
        reason: 'uncertain_status',
        intervals: [],
      });
      await send(3, 'Actually 11', { ...arrival('11'), replaces: ['invented'] });
      expect((await visible()).map((row) => row.sourceMessageKey)).toEqual([key(1), key(1)]);
      const jobs = await db.select().from(slackMessages).where(eq(slackMessages.teamId, team));
      expect(jobs.filter((job) => job.state === 'review')).toHaveLength(2);
    });
    it('defers later messages until earlier jobs finish without consuming attempts', async () => {
      await enqueueSlackEvent(envelope(1, 'In at 10'));
      await enqueueSlackEvent(envelope(2, 'Actually 11'));
      expect(await processMessage(2)).toMatchObject({ retried: 1 });
      expect(extractAttendance).not.toHaveBeenCalled();
      const [pending] = await db
        .select()
        .from(slackMessages)
        .where(eq(slackMessages.messageKey, key(2)));
      expect(pending.attempts).toBe(0);
      vi.mocked(extractAttendance).mockResolvedValueOnce(arrival('10'));
      await processMessage(1);
      vi.mocked(extractAttendance).mockResolvedValueOnce({
        ...arrival('11'),
        replaces: ['prior_1'],
      });
      expect(await processMessage(2)).toMatchObject({ applied: 1 });
    });
    it('discards a model result if a source changes while the request is running', async () => {
      await send(1, 'In at 10', arrival('10'));
      vi.mocked(extractAttendance).mockImplementationOnce(async () => {
        await remove(1, 3);
        return { ...arrival('11'), replaces: ['prior_1'] };
      });
      await enqueueSlackEvent(envelope(2, 'Actually 11'));
      expect(await processMessage(2)).toMatchObject({ retried: 1 });
      expect(await visible()).toHaveLength(0);
    });
    it('does not suppress a newly edited source revision with an old correction', async () => {
      await send(1, 'In at 10', arrival('10'));
      await send(2, 'Actually 11', { ...arrival('11'), replaces: ['prior_1'] });
      await edit(1, 3, 'In at 12', arrival('12'));
      expect((await visible()).filter((row) => row.sourceMessageKey === key(1))).toHaveLength(2);
    });
    it('keeps the final correction after an intermediate correction is deleted', async () => {
      await send(1, 'In at 10', arrival('10'));
      await send(2, 'Actually tomorrow', { ...arrival('10', '2026-09-08'), replaces: ['prior_1'] });
      await send(3, 'Actually next week', {
        ...arrival('10', '2026-09-14'),
        replaces: ['prior_1'],
      });
      await remove(2, 4);
      expect((await visible()).map((row) => row.sourceMessageKey)).toEqual([key(3), key(3)]);
      await remove(3, 5);
      expect((await visible()).map((row) => row.sourceMessageKey)).toEqual([key(1), key(1)]);
    });
    it('limits history to eight prior announcements and excludes other people, channels and future revisions', async () => {
      for (let minute = 1; minute <= 10; minute++) await send(minute, 'In at 10', arrival('10'));
      const job = {
        messageKey: key(11),
        teamId: team,
        channelId: channel,
        slackUserId: author,
        messageTs: ts(11),
        revision: ts(11),
      };
      expect((await loadAttendanceContext(job, userId)).entries).toHaveLength(8);
      expect(
        (await loadAttendanceContext({ ...job, slackUserId: 'OTHER' }, userId)).entries
      ).toHaveLength(0);
      expect(
        (await loadAttendanceContext({ ...job, channelId: 'OTHER' }, userId)).entries
      ).toHaveLength(0);
      expect(
        (await loadAttendanceContext({ ...job, revision: ts(1) }, userId)).entries
      ).toHaveLength(0);
      await db
        .update(slackMessages)
        .set({ reviewText: 'x'.repeat(3000) })
        .where(eq(slackMessages.messageKey, key(10)));
      expect((await loadAttendanceContext(job, userId)).entries.at(-1)?.text).toHaveLength(1500);
    });
  }
);
