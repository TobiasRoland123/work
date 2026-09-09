import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db, pool } from '@/db';
import { slackMessages, status, users } from '@/db/schema';
import {
  cleanupExpiredSlackMessages,
  enqueueSlackEvent,
  processSlackInbox,
  processQueuedSlackMessage,
  SlackMessagePendingError,
} from '@/lib/slack/inbox';
import { extractAttendance } from '@/lib/slack/extraction';
import { selectActiveStatus } from '@/lib/status/active';
import { syncSlackUsers } from '@/scripts/seed';
import { userService } from '@/lib/services/userService';
import { resolveSlackIdentity } from '@/lib/slack/identity';

const broadcastSend = vi.hoisted(() => vi.fn().mockResolvedValue({ status: 'ok' }));
const broadcastChannel = vi.hoisted(() => vi.fn(() => ({ send: broadcastSend })));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { channel: broadcastChannel },
}));
vi.mock('@/lib/slack/extraction', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/slack/extraction')>()),
  extractAttendance: vi.fn(),
}));
const team = 'TTEST',
  channel = 'CTEST',
  slackUser = 'UTEST',
  userID = randomUUID();
const messageTs = '1788766200.000001';
const key = `${team}:${channel}:${messageTs}`;
const original = {
  type: 'event_callback',
  team_id: team,
  event_id: 'Ev1',
  event: {
    type: 'message',
    channel,
    user: slackUser,
    ts: messageTs,
    text: 'WFH today',
  },
};
const extraction = {
  decision: 'apply' as const,
  reason: 'clear' as const,
  intervals: [
    {
      status: 'FROM_HOME' as const,
      fromDate: '2026-09-07',
      toDate: '2026-09-07',
      startTime: null,
      endTime: null,
      startApproximate: false,
      endApproximate: false,
      comment: null,
    },
  ],
};

// Poll a due job deterministically: PostgreSQL now() includes microseconds, whereas
// the worker's JS clock has millisecond precision. A real scheduled poll occurs later.
async function makeQueuedMessageDue(messageKey = key) {
  await db
    .update(slackMessages)
    .set({ nextAttemptAt: new Date(0) })
    .where(eq(slackMessages.messageKey, messageKey));
}

// Opt-in only. Never run these mutations against the developer's normal database.
describe.runIf(process.env.SLACK_TEST_DATABASE === '1')(
  'Slack inbox on isolated PostgreSQL',
  () => {
    beforeAll(async () => {
      if (process.env.PGHOST !== '127.0.0.1' || process.env.PGDATABASE !== 'work_slack_test')
        throw new Error('Dedicated local test database required');
      vi.stubEnv('SLACK_TEAM_ID', team);
      vi.stubEnv('SLACK_CHANNEL_ID', channel);
      await db.insert(users).values({
        userId: userID,
        email: `${userID}@example.com`,
        slackTeamId: team,
        slackUserId: slackUser,
      });
    });
    beforeEach(async () => {
      await db.delete(status).where(eq(status.userID, userID));
      await db.delete(slackMessages).where(eq(slackMessages.messageKey, key));
      vi.mocked(extractAttendance).mockReset().mockResolvedValue(extraction);
      broadcastSend.mockClear();
      broadcastChannel.mockClear();
    });
    afterAll(async () => {
      await db.delete(slackMessages).where(eq(slackMessages.messageKey, key));
      await db.delete(users).where(eq(users.userId, userID));
      vi.unstubAllEnvs();
      await pool.end();
    });
    it('deduplicates deliveries and clears text after writing one status', async () => {
      await Promise.all([enqueueSlackEvent(original), enqueueSlackEvent(original)]);
      await makeQueuedMessageDue();
      expect(await processSlackInbox()).toMatchObject({ applied: 1 });
      expect(await processSlackInbox()).toMatchObject({ applied: 0 });
      const rows = await db.select().from(status).where(eq(status.userID, userID));
      expect(rows).toHaveLength(1);
      expect(rows[0].details).toBeNull();
      const [job] = await db.select().from(slackMessages).where(eq(slackMessages.messageKey, key));
      expect(job.text).toBeNull();
      expect(job.state).toBe('applied');
    });
    it('applies uncertain status as a source-linked description using the original message text and Copenhagen day', async () => {
      const uncertainMessageTs = '1788733800.000001';
      const uncertainKey = `${team}:${channel}:${uncertainMessageTs}`;
      const uncertainMessage = {
        ...original,
        event: {
          ...original.event,
          ts: uncertainMessageTs,
          text: 'Maybe I can work from home',
        },
      };
      vi.mocked(extractAttendance).mockResolvedValue({
        decision: 'review',
        reason: 'uncertain_status',
        intervals: [],
      });
      try {
        await enqueueSlackEvent(uncertainMessage);
        await makeQueuedMessageDue(uncertainKey);
        expect(await processSlackInbox(1, uncertainKey)).toMatchObject({ applied: 1 });
        const [row] = await db.select().from(status).where(eq(status.userID, userID));
        expect(row).toMatchObject({
          userID,
          status: null,
          details: uncertainMessage.event.text,
          fromDate: '2026-09-07',
          toDate: '2026-09-07',
          sourceMessageKey: uncertainKey,
        });
        const [job] = await db
          .select()
          .from(slackMessages)
          .where(eq(slackMessages.messageKey, uncertainKey));
        expect(job).toMatchObject({ state: 'applied', text: null });
        expect(job.outcome).toEqual({ reason: 'uncertain_status' });
        expect(broadcastChannel).toHaveBeenCalledWith('status-sync');
        expect(broadcastSend).toHaveBeenCalledWith({
          type: 'broadcast',
          event: 'status_updated',
          payload: {},
        });
      } finally {
        await db.delete(slackMessages).where(eq(slackMessages.messageKey, uncertainKey));
      }
    });
    it('updates and removes an uncertain status description with Slack edits and deletion', async () => {
      const uncertainMessageTs = '1788733800.000001';
      const uncertainKey = `${team}:${channel}:${uncertainMessageTs}`;
      const editedRevision = '1788737400.000001';
      const uncertainMessage = {
        ...original,
        event: {
          ...original.event,
          ts: uncertainMessageTs,
          text: 'Maybe I can work from home',
        },
      };
      vi.mocked(extractAttendance).mockResolvedValue({
        decision: 'review',
        reason: 'uncertain_status',
        intervals: [],
      });
      try {
        await enqueueSlackEvent(uncertainMessage);
        await makeQueuedMessageDue(uncertainKey);
        await processSlackInbox(1, uncertainKey);
        await enqueueSlackEvent({
          ...uncertainMessage,
          event: {
            ...uncertainMessage.event,
            subtype: 'message_changed',
            event_ts: editedRevision,
            message: {
              ...uncertainMessage.event,
              text: 'Possibly working from home',
              edited: { ts: editedRevision },
            },
          },
        });
        await makeQueuedMessageDue(uncertainKey);
        await processSlackInbox(1, uncertainKey);
        expect(await db.select().from(status).where(eq(status.userID, userID))).toMatchObject([
          { details: 'Possibly working from home', sourceMessageKey: uncertainKey },
        ]);
        await enqueueSlackEvent({
          ...uncertainMessage,
          event: {
            type: 'message',
            subtype: 'message_deleted',
            channel,
            deleted_ts: uncertainMessageTs,
            event_ts: '1788737500.000001',
            previous_message: uncertainMessage.event,
          },
        });
        await expect(
          processQueuedSlackMessage(uncertainKey, '1788737500.000001')
        ).resolves.toBeUndefined();
        expect(await db.select().from(status).where(eq(status.userID, userID))).toHaveLength(0);
      } finally {
        await db.delete(slackMessages).where(eq(slackMessages.messageKey, uncertainKey));
      }
    });
    it.each([
      'uncertain_date',
      'uncertain_time',
      'other_person',
      'conflicting',
      'unsupported',
    ] as const)('keeps %s extraction decisions in review', async (reason) => {
      vi.mocked(extractAttendance).mockResolvedValue({
        decision: 'review',
        reason,
        intervals: [],
      });
      await enqueueSlackEvent(original);
      expect(await processSlackInbox(1, key)).toMatchObject({ review: 1, applied: 0 });
      expect(await db.select().from(status).where(eq(status.userID, userID))).toHaveLength(0);
      const [job] = await db.select().from(slackMessages).where(eq(slackMessages.messageKey, key));
      expect(job).toMatchObject({ state: 'review', text: null, outcome: { reason } });
      expect(broadcastSend).not.toHaveBeenCalled();
    });
    it('processes a newly received message immediately, ahead of unrelated backlog', async () => {
      const newer = { ...original, event: { ...original.event, ts: '1788766300.000001' } };
      const newerKey = `${team}:${channel}:${newer.event.ts}`;
      try {
        expect(await enqueueSlackEvent(original)).toMatchObject({
          outcome: 'queued',
          messageKey: key,
        });
        expect(await enqueueSlackEvent(original)).toMatchObject({ outcome: 'duplicate_or_stale' });
        expect(await enqueueSlackEvent(newer)).toMatchObject({
          outcome: 'queued',
          messageKey: newerKey,
        });
        // No clock adjustment: the new insert must already be due for event-triggered work.
        expect(await processSlackInbox(1, newerKey)).toMatchObject({ applied: 1 });
        const [older] = await db
          .select()
          .from(slackMessages)
          .where(eq(slackMessages.messageKey, key));
        expect(older.state).toBe('pending');
        expect(older.attempts).toBe(0);
        expect(await processSlackInbox(1, newerKey)).toMatchObject({ applied: 0 });
        expect(await processSlackInbox()).toMatchObject({ applied: 1 });
      } finally {
        await db.delete(slackMessages).where(eq(slackMessages.messageKey, newerKey));
      }
    });
    it('claims an event-triggered message only once under concurrent workers', async () => {
      await enqueueSlackEvent(original);
      const results = await Promise.all([processSlackInbox(1, key), processSlackInbox(1, key)]);
      expect(results.reduce((sum, result) => sum + result.applied, 0)).toBe(1);
      expect(extractAttendance).toHaveBeenCalledOnce();
      expect(await db.select().from(status).where(eq(status.userID, userID))).toHaveLength(1);
    });
    it('keeps a failed queue job pending through backoff and acknowledges only after success', async () => {
      await enqueueSlackEvent(original);
      vi.mocked(extractAttendance).mockRejectedValueOnce(new Error('temporary outage'));
      await expect(processQueuedSlackMessage(key, messageTs)).rejects.toBeInstanceOf(
        SlackMessagePendingError
      );
      await expect(processQueuedSlackMessage(key, messageTs)).rejects.toMatchObject({
        afterSeconds: expect.any(Number),
      });
      expect(extractAttendance).toHaveBeenCalledTimes(1);
      const [pending] = await db
        .select()
        .from(slackMessages)
        .where(eq(slackMessages.messageKey, key));
      expect(pending).toMatchObject({ state: 'pending', attempts: 1, text: original.event.text });
      await makeQueuedMessageDue();
      await expect(processQueuedSlackMessage(key, messageTs)).resolves.toBeUndefined();
      await expect(processQueuedSlackMessage(key, messageTs)).resolves.toBeUndefined();
      expect(extractAttendance).toHaveBeenCalledTimes(2);
      expect(await db.select().from(status).where(eq(status.userID, userID))).toHaveLength(1);
    });
    it('does not acknowledge a delivery while another worker holds the database lease', async () => {
      await enqueueSlackEvent(original);
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      vi.mocked(extractAttendance).mockImplementationOnce(async () => {
        await held;
        return extraction;
      });
      const first = processQueuedSlackMessage(key, messageTs);
      try {
        await vi.waitFor(() => expect(extractAttendance).toHaveBeenCalledOnce());
        await expect(processQueuedSlackMessage(key, messageTs)).rejects.toBeInstanceOf(
          SlackMessagePendingError
        );
      } finally {
        release();
      }
      await expect(first).resolves.toBeUndefined();
    });
    it('acknowledges old revisions without processing a newer edit', async () => {
      await enqueueSlackEvent(original);
      const revision = '1788766700.000001';
      await enqueueSlackEvent({
        ...original,
        event: {
          type: 'message',
          channel,
          subtype: 'message_changed',
          message: { ...original.event, text: 'WFH tomorrow', edited: { ts: revision } },
        },
      });
      await expect(processQueuedSlackMessage(key, messageTs)).resolves.toBeUndefined();
      expect(extractAttendance).not.toHaveBeenCalled();
      await expect(processQueuedSlackMessage(key, revision)).resolves.toBeUndefined();
      expect(extractAttendance).toHaveBeenCalledOnce();
    });
    it('bounds repeated killed workers without another AI call and clears the source text', async () => {
      await enqueueSlackEvent(original);
      await db
        .update(slackMessages)
        .set({ attempts: 5, nextAttemptAt: new Date(0) })
        .where(eq(slackMessages.messageKey, key));
      await expect(processQueuedSlackMessage(key, messageTs)).resolves.toBeUndefined();
      expect(extractAttendance).not.toHaveBeenCalled();
      const [job] = await db.select().from(slackMessages).where(eq(slackMessages.messageKey, key));
      expect(job).toMatchObject({
        state: 'review',
        text: null,
        outcome: { reason: 'processing_failed' },
      });
    });
    it('stops queue retries after five failed extraction attempts', async () => {
      await enqueueSlackEvent(original);
      vi.mocked(extractAttendance).mockRejectedValue(new Error('provider down'));
      for (let attempt = 1; attempt <= 5; attempt++) {
        await makeQueuedMessageDue();
        if (attempt < 5)
          await expect(processQueuedSlackMessage(key, messageTs)).rejects.toBeInstanceOf(
            SlackMessagePendingError
          );
        else await expect(processQueuedSlackMessage(key, messageTs)).resolves.toBeUndefined();
      }
      expect(extractAttendance).toHaveBeenCalledTimes(5);
      const [job] = await db.select().from(slackMessages).where(eq(slackMessages.messageKey, key));
      expect(job).toMatchObject({ state: 'review', text: null, attempts: 5 });
    });
    it('can purge expired text during daily maintenance without processing any job', async () => {
      await enqueueSlackEvent(original);
      await db
        .update(slackMessages)
        .set({ receivedAt: new Date(Date.now() - 86400001) })
        .where(eq(slackMessages.messageKey, key));
      await cleanupExpiredSlackMessages();
      expect(extractAttendance).not.toHaveBeenCalled();
      const [job] = await db.select().from(slackMessages).where(eq(slackMessages.messageKey, key));
      expect(job).toMatchObject({
        state: 'review',
        text: null,
        outcome: { reason: 'processing_expired' },
      });
      await expect(processQueuedSlackMessage(key, messageTs)).resolves.toBeUndefined();
    });
    it('persists and updates AI-separated comments while applying uncertain descriptions and deletion behavior', async () => {
      const real =
        await vi.importActual<typeof import('@/lib/slack/extraction')>('@/lib/slack/extraction');
      vi.mocked(extractAttendance).mockImplementation(real.extractAttendance);
      vi.stubEnv('AI_GATEWAY_API_KEY', 'synthetic-test-key');
      vi.stubEnv('SLACK_EXTRACTION_MODEL', 'mock-model');
      const response = (comment: string | null, decision = 'apply') =>
        new Response(
          JSON.stringify({
            choices: [
              {
                index: 0,
                finish_reason: 'stop',
                message: {
                  role: 'assistant',
                  content: JSON.stringify({
                    decision,
                    reason: decision === 'apply' ? 'clear' : 'uncertain_status',
                    intervals:
                      decision === 'apply'
                        ? [{ ...extraction.intervals[0], status: 'IN_LATE', comment }]
                        : [],
                  }),
                },
              },
            ],
          }),
          { headers: { 'content-type': 'application/json' } }
        );
      const request = vi
        .fn()
        .mockResolvedValueOnce(response('going to dentist'))
        .mockResolvedValueOnce(response('waiting for a repair technician'))
        .mockResolvedValueOnce(response('invented diagnosis'))
        .mockResolvedValueOnce(response(null, 'review'))
        .mockResolvedValueOnce(response(null));
      vi.stubGlobal('fetch', request);
      const edited = (text: string, revision: string) => ({
        ...original,
        event: {
          type: 'message',
          subtype: 'message_changed',
          channel,
          event_ts: revision,
          message: { ...original.event, text, edited: { ts: revision } },
        },
      });
      const read = () => db.select().from(status).where(eq(status.userID, userID));
      try {
        await enqueueSlackEvent({
          ...original,
          event: { ...original.event, text: 'in later, going to dentist' },
        });
        await makeQueuedMessageDue();
        await processSlackInbox();
        expect(await read()).toMatchObject([
          {
            userID,
            status: 'IN_LATE',
            details: 'going to dentist',
            time: null,
            sourceMessageKey: key,
          },
        ]);
        const [job] = await db
          .select()
          .from(slackMessages)
          .where(eq(slackMessages.messageKey, key));
        expect(job.text).toBeNull();
        await enqueueSlackEvent(
          edited('in later, waiting for a repair technician', '1788766500.000001')
        );
        // Keep the old status/comment until the replacement is validated and committed.
        expect((await read())[0].details).toBe('going to dentist');
        await processSlackInbox();
        expect(await read()).toMatchObject([{ details: 'waiting for a repair technician' }]);
        expect(await read()).toHaveLength(1);
        await enqueueSlackEvent(edited('in later, going to dentist', '1788766600.000001'));
        await processSlackInbox();
        expect((await read())[0].details).toBe('waiting for a repair technician');
        await enqueueSlackEvent(edited('maybe later', '1788766700.000001'));
        await processSlackInbox();
        expect((await read())[0].details).toBe('maybe later');
        await enqueueSlackEvent(edited('in later', '1788766800.000001'));
        await processSlackInbox();
        expect((await read())[0].details).toBe('Arrival time unspecified');
        await db.insert(status).values({ userID, status: 'VACATION', details: 'manual comment' });
        await enqueueSlackEvent({
          ...original,
          event: {
            type: 'message',
            subtype: 'message_deleted',
            channel,
            deleted_ts: messageTs,
            ts: '1788766900.000001',
          },
        });
        expect(await read()).toMatchObject([{ details: 'manual comment' }]);
        expect(await read()).toHaveLength(1);
      } finally {
        vi.unstubAllGlobals();
      }
    });
    it.each(['review', 'ignore'] as const)(
      '%s edits handle descriptions, preserve manual rows and ignore stale replay',
      async (decision) => {
        await db.insert(status).values({ userID, status: 'VACATION', details: 'manual' });
        await enqueueSlackEvent(original);
        await makeQueuedMessageDue();
        await processSlackInbox();
        const edited = {
          ...original,
          event: {
            type: 'message',
            subtype: 'message_changed',
            channel,
            event_ts: '1788766500.000001',
            message: {
              ...original.event,
              text: 'Maybe tomorrow',
              edited: { ts: '1788766500.000001' },
            },
          },
        };
        vi.mocked(extractAttendance).mockResolvedValue({
          decision,
          reason: decision === 'review' ? 'uncertain_date' : 'not_attendance',
          intervals: [],
        });
        await enqueueSlackEvent(edited);
        await makeQueuedMessageDue();
        await processSlackInbox();
        await enqueueSlackEvent(original);
        await makeQueuedMessageDue();
        let rows = await db.select().from(status).where(eq(status.userID, userID));
        expect(rows).toHaveLength(2);
        expect(rows.find((row) => row.sourceMessageKey === key)).toMatchObject(
          decision === 'ignore'
            ? { status: null, details: edited.event.message.text }
            : { status: 'FROM_HOME' }
        );
        expect(rows.some((row) => row.details === 'manual')).toBe(true);
        await enqueueSlackEvent({
          ...original,
          event: {
            type: 'message',
            subtype: 'message_deleted',
            channel,
            deleted_ts: messageTs,
            event_ts: '1788766600.000001',
            previous_message: original.event,
          },
        });
        await enqueueSlackEvent(edited);
        const [job] = await db
          .select()
          .from(slackMessages)
          .where(eq(slackMessages.messageKey, key));
        expect(job.state).toBe('deleted');
        rows = await db.select().from(status).where(eq(status.userID, userID));
        expect(rows).toHaveLength(1);
      }
    );
    it('does not commit stale AI results when a deletion arrives during processing', async () => {
      await enqueueSlackEvent(original);
      await makeQueuedMessageDue();
      vi.mocked(extractAttendance).mockImplementation(async () => {
        await enqueueSlackEvent({
          ...original,
          event: {
            type: 'message',
            subtype: 'message_deleted',
            channel,
            deleted_ts: messageTs,
            event_ts: '1788766600.000001',
            previous_message: original.event,
          },
        });
        return extraction;
      });
      expect(await processSlackInbox()).toMatchObject({ superseded: 1 });
      expect(await db.select().from(status).where(eq(status.userID, userID))).toHaveLength(0);
    });
    it('backs off failures and clears abandoned text after 24 hours', async () => {
      await enqueueSlackEvent(original);
      await makeQueuedMessageDue();
      vi.mocked(extractAttendance).mockRejectedValue(new Error('AI unavailable'));
      expect(await processSlackInbox()).toMatchObject({ retried: 1 });
      expect(await processSlackInbox()).toMatchObject({ retried: 0 });
      await db
        .update(slackMessages)
        .set({ receivedAt: new Date(Date.now() - 90000000) })
        .where(eq(slackMessages.messageKey, key));
      await processSlackInbox();
      const [job] = await db.select().from(slackMessages).where(eq(slackMessages.messageKey, key));
      expect(job.text).toBeNull();
      expect(job.state).toBe('review');
    });
    it('links a legacy email once under racing logins and preserves its old ID/history', async () => {
      const legacyID = randomUUID(),
        email = `${legacyID}@example.com`;
      await db.insert(users).values({ userId: legacyID, email: email.toUpperCase() });
      await db.insert(status).values({ userID: legacyID, status: 'FROM_HOME' });
      const identity = { email, slackTeamId: team, slackUserId: 'ULEGACY' };
      try {
        const results = await Promise.all([
          resolveSlackIdentity(identity),
          resolveSlackIdentity(identity),
        ]);
        expect(results.every((user) => user.userId === legacyID)).toBe(true);
        await expect(resolveSlackIdentity({ ...identity, slackUserId: 'UOTHER' })).rejects.toThrow(
          'already linked'
        );
        expect(await db.select().from(status).where(eq(status.userID, legacyID))).toHaveLength(1);
      } finally {
        await db.delete(users).where(eq(users.userId, legacyID));
      }
    });

    it('orders manual/imported announcements using timestamptz even when created_at wall clocks differ', async () => {
      const rows = await db
        .insert(status)
        .values([
          {
            userID,
            status: 'IN_OFFICE',
            createdAt: '2026-09-07 10:00:00',
            announcedAt: new Date('2026-09-07T08:00:00Z'),
            fromDate: '2026-09-07',
            toDate: '2026-09-07',
          },
          {
            userID,
            status: 'FROM_HOME',
            createdAt: '2026-09-07 09:00:00',
            announcedAt: new Date('2026-09-07T09:00:00Z'),
            fromDate: '2026-09-07',
            toDate: '2026-09-07',
          },
        ])
        .returning();
      expect(selectActiveStatus(rows, new Date('2026-09-07T10:00:00Z'))?.status).toBe('FROM_HOME');
    });
    it('deactivates mapped users from a full snapshot without removing their history', async () => {
      await db.insert(status).values({ userID, status: 'FROM_HOME' });
      vi.stubEnv('SLACK_BOT_TOKEN', 'synthetic-bot');
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ ok: true, team_id: team, user_id: 'BTEST' }), {
            status: 200,
          })
        )
      );
      try {
        await syncSlackUsers([{ id: slackUser, team_id: team, deleted: true }]);
        const [inactive] = await db.select().from(users).where(eq(users.userId, userID));
        expect(inactive.slackDeactivated).toBe(true);
        expect((await userService.getAllUsers()).some((user) => user.userId === userID)).toBe(
          false
        );
        await expect(
          resolveSlackIdentity({ slackTeamId: team, slackUserId: slackUser, email: inactive.email })
        ).rejects.toThrow('inactive');
        expect(await db.select().from(status).where(eq(status.userID, userID))).toHaveLength(1);
      } finally {
        await db.update(users).set({ slackDeactivated: false }).where(eq(users.userId, userID));
        vi.unstubAllGlobals();
      }
    });
  }
);
