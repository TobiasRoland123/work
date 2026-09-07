import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db, pool } from '@/db';
import { slackMessages, status, users } from '@/db/schema';
import { enqueueSlackEvent, processSlackInbox } from '@/lib/slack/inbox';
import { extractAttendance } from '@/lib/slack/extraction';
import { selectActiveStatus } from '@/lib/status/active';
import { syncSlackUsers } from '@/scripts/seed';
import { userService } from '@/lib/services/userService';
import { resolveSlackIdentity } from '@/lib/slack/identity';

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
async function makeQueuedMessageDue() {
  await db
    .update(slackMessages)
    .set({ nextAttemptAt: new Date(0) })
    .where(eq(slackMessages.messageKey, key));
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
    it('persists and updates AI-separated comments while preserving unclear edits and deletion behavior', async () => {
      const real =
        await vi.importActual<typeof import('@/lib/slack/extraction')>('@/lib/slack/extraction');
      vi.mocked(extractAttendance).mockImplementation(real.extractAttendance);
      vi.stubEnv('OPENAI_API_KEY', 'synthetic-test-key');
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
        expect((await read())[0].details).toBe('waiting for a repair technician');
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
      '%s edits preserve valid rows until explicit deletion and ignore stale replay',
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
        await processSlackInbox();
        await enqueueSlackEvent(original);
        await makeQueuedMessageDue();
        let rows = await db.select().from(status).where(eq(status.userID, userID));
        expect(rows).toHaveLength(2);
        expect(rows.some((row) => row.sourceMessageKey === key && row.status === 'FROM_HOME')).toBe(
          true
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
