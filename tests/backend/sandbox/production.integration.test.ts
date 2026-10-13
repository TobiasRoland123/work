import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db, pool } from '@/db';
import { slackMessages, status, users } from '@/db/schema';
import { canUseSandbox, requireSandboxAccess } from '@/lib/auth/sandbox';
import { enqueueSlackEvent, processSlackInbox } from '@/lib/slack/inbox';
import { userService } from '@/lib/services/userService';
import { statusService } from '@/lib/services/statusService';
import { seedSandboxProfiles, SANDBOX_FIXTURES } from '@/lib/sandbox/profiles';
import {
  sendSandboxMessage,
  editSandboxMessage,
  deleteSandboxMessage,
  runSandboxRetries,
  resetSandboxData,
} from '@/lib/sandbox/service';

const session = vi.hoisted(() => ({ userId: '' }));
const broadcast = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: async () => ({ provider: 'slack', userId: session.userId }) }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));
vi.mock('@/lib/supabaseClient', () => ({ supabase: { channel: () => ({ send: broadcast }) } }));

const operatorId = randomUUID();
const fixtureId = randomUUID();
const realTeam = 'T_SANDBOX_OPERATOR_TEST';
const realChannel = 'C_REAL_TEST';
const fixtureSlackId = 'U_SANDBOX_PRODUCTION_TEST';
const staleRealTs = '1788766200.000777';
const realKey = `${realTeam}:${realChannel}:${staleRealTs}`;

async function enqueueRealMessage() {
  const result = await enqueueSlackEvent({
    type: 'event_callback',
    team_id: realTeam,
    event_id: 'EvProductionTest',
    event: {
      type: 'message',
      channel: realChannel,
      user: 'U_REAL_OPERATOR',
      ts: staleRealTs,
      text: 'wfh',
    },
  });
  expect(result).toMatchObject({ outcome: 'queued', messageKey: realKey });
}

// Production behavior, exercised only against a dedicated local database.
describe.runIf(process.env.SLACK_TEST_DATABASE === '1')(
  'sandbox in a hosted real workspace',
  () => {
    beforeAll(async () => {
      if (process.env.PGHOST !== '127.0.0.1' || process.env.PGDATABASE !== 'work_slack_test')
        throw new Error('Dedicated local test database required');
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('SLACK_TEAM_ID', realTeam);
      vi.stubEnv('SLACK_CHANNEL_ID', realChannel);
      vi.stubEnv('AI_GATEWAY_API_KEY', '');
      session.userId = operatorId;
      await db.insert(users).values([
        {
          userId: operatorId,
          email: `${operatorId}@example.com`,
          firstName: 'Real operator',
          slackTeamId: realTeam,
          slackUserId: 'U_REAL_OPERATOR',
          systemRole: 'ADMIN',
        },
        {
          userId: fixtureId,
          email: `${fixtureId}@sandbox.local`,
          firstName: 'Test author',
          slackTeamId: 'T_LOCAL',
          slackUserId: fixtureSlackId,
        },
      ]);
    });
    beforeEach(async () => {
      await db.delete(slackMessages).where(eq(slackMessages.teamId, 'T_LOCAL'));
      await db.delete(slackMessages).where(eq(slackMessages.messageKey, realKey));
      await db.delete(status).where(inArray(status.userID, [operatorId, fixtureId]));
      await db
        .update(users)
        .set({ canUseSandbox: false, slackDeactivated: false, slackTeamId: realTeam })
        .where(eq(users.userId, operatorId));
      broadcast.mockClear();
    });
    afterAll(async () => {
      await db.delete(slackMessages).where(eq(slackMessages.teamId, 'T_LOCAL'));
      await db.delete(slackMessages).where(eq(slackMessages.messageKey, realKey));
      await db
        .delete(users)
        .where(
          inArray(users.userId, [
            operatorId,
            fixtureId,
            ...SANDBOX_FIXTURES.map((profile) => profile.userId),
          ])
        );
      vi.unstubAllEnvs();
      await pool.end();
    });

    it('requires the account grant even for an admin and rechecks revocation and membership', async () => {
      await expect(requireSandboxAccess()).rejects.toThrow('NOT_FOUND');
      await db.update(users).set({ canUseSandbox: true }).where(eq(users.userId, operatorId));
      await expect(requireSandboxAccess()).resolves.toBeUndefined();
      await db.update(users).set({ canUseSandbox: false }).where(eq(users.userId, operatorId));
      await expect(canUseSandbox(operatorId)).resolves.toBe(false);
      await userService.updateUser(operatorId, { canUseSandbox: true });
      await expect(canUseSandbox(operatorId)).resolves.toBe(false);
      await db
        .update(users)
        .set({ canUseSandbox: true, slackDeactivated: true })
        .where(eq(users.userId, operatorId));
      await expect(canUseSandbox(operatorId)).resolves.toBe(false);
      await db
        .update(users)
        .set({ slackDeactivated: false, slackTeamId: 'T_OTHER' })
        .where(eq(users.userId, operatorId));
      await expect(canUseSandbox(operatorId)).resolves.toBe(false);
    });

    it('processes sandbox messages, edits and deletions without touching stale real jobs or broadcasting', async () => {
      await enqueueRealMessage();
      await db
        .update(slackMessages)
        .set({ receivedAt: new Date(0) })
        .where(eq(slackMessages.messageKey, realKey));
      const sent = await sendSandboxMessage({ slackUserId: fixtureSlackId, text: 'wfh' });
      expect(sent.processing).toMatchObject({ kind: 'terminal', state: 'applied' });
      expect(sent.interpretation?.intervals).toMatchObject([{ status: 'FROM_HOME' }]);
      const edited = await editSandboxMessage({
        slackUserId: fixtureSlackId,
        messageTs: sent.messageTs,
        text: 'sick',
      });
      expect(edited.processing).toMatchObject({ kind: 'terminal', state: 'applied' });
      await deleteSandboxMessage({ slackUserId: fixtureSlackId, messageTs: sent.messageTs });
      expect(await db.select().from(status).where(eq(status.userID, fixtureId))).toHaveLength(0);
      const [realJob] = await db
        .select()
        .from(slackMessages)
        .where(eq(slackMessages.messageKey, realKey));
      expect(realJob).toMatchObject({ state: 'pending', attempts: 0, text: 'wfh' });
      expect(broadcast).not.toHaveBeenCalled();
      expect(process.env.SLACK_TEAM_ID).toBe(realTeam);
    });

    it('keeps retries and resets scoped and hides test profiles/statuses from normal lists', async () => {
      await enqueueRealMessage();
      await db
        .update(slackMessages)
        .set({ receivedAt: new Date(0), nextAttemptAt: new Date(0) })
        .where(eq(slackMessages.messageKey, realKey));
      await sendSandboxMessage({ slackUserId: fixtureSlackId, text: 'wfh' });
      await db.insert(status).values({ userID: operatorId, status: 'IN_OFFICE' });
      expect((await userService.getAllUsers(false)).map((row) => row.userId)).toEqual([operatorId]);
      expect((await statusService.getAllStatuses()).map((row) => row.userID)).toEqual([operatorId]);
      await runSandboxRetries();
      const [realJob] = await db
        .select()
        .from(slackMessages)
        .where(eq(slackMessages.messageKey, realKey));
      expect(realJob).toMatchObject({ state: 'pending', attempts: 0 });
      await resetSandboxData();
      expect(await db.select().from(status).where(eq(status.userID, fixtureId))).toHaveLength(0);
      expect(await db.select().from(status).where(eq(status.userID, operatorId))).toHaveLength(1);
      expect(
        await db.select().from(slackMessages).where(eq(slackMessages.messageKey, realKey))
      ).toHaveLength(1);
      expect(broadcast).not.toHaveBeenCalled();
    });

    it('keeps the normal Slack worker from consuming or expiring sandbox jobs', async () => {
      const testTs = '1788766200.000778';
      const sandboxKey = `T_LOCAL:C_LOCAL:${testTs}`;
      const result = await enqueueSlackEvent(
        {
          type: 'event_callback',
          team_id: 'T_LOCAL',
          event_id: 'EvSandboxTest',
          event: {
            type: 'message',
            channel: 'C_LOCAL',
            user: fixtureSlackId,
            ts: testTs,
            text: 'wfh',
          },
        },
        { teamId: 'T_LOCAL', channelId: 'C_LOCAL' }
      );
      expect(result.outcome).toBe('queued');
      await db
        .update(slackMessages)
        .set({ receivedAt: new Date(0), nextAttemptAt: new Date(0) })
        .where(eq(slackMessages.messageKey, sandboxKey));
      await processSlackInbox();
      const [job] = await db
        .select()
        .from(slackMessages)
        .where(eq(slackMessages.messageKey, sandboxKey));
      expect(job).toMatchObject({ state: 'pending', attempts: 0, text: 'wfh' });
      expect(broadcast).not.toHaveBeenCalled();
    });

    it('seeds hosted fixture profiles and refuses to replace a real account with a conflicting fixture ID', async () => {
      await db
        .insert(users)
        .values({ userId: 'sandbox-anna', email: 'conflict@example.com', slackTeamId: realTeam });
      try {
        await expect(seedSandboxProfiles()).rejects.toThrow('conflicts');
        const [realAccount] = await db.select().from(users).where(eq(users.userId, 'sandbox-anna'));
        expect(realAccount.slackTeamId).toBe(realTeam);
      } finally {
        await db.delete(users).where(eq(users.userId, 'sandbox-anna'));
      }
      await expect(seedSandboxProfiles()).resolves.toMatchObject({ profiles: 4 });
      const seeded = await db
        .select()
        .from(users)
        .where(
          inArray(
            users.userId,
            SANDBOX_FIXTURES.map((profile) => profile.userId)
          )
        );
      expect(seeded).toHaveLength(4);
      expect(seeded.every((profile) => profile.slackTeamId === 'T_LOCAL')).toBe(true);
    });
  }
);
