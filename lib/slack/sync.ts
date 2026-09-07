import { and, eq, inArray } from 'drizzle-orm';
import { db, pool } from '@/db';
import { slackIdentities, slackMessages, slackSyncState, status } from '@/db/schema';
import { SlackClient, SLACK_TEAM_ID } from './client';
import { syncDirectory } from './directory';
import { interpretAttendance } from './attendance';
import { reconcileAttendance } from './sync-engine';

// A session advisory lock covers API calls without holding an open DB transaction.
export async function withSlackSyncLock<T>(run: () => Promise<T>): Promise<T> {
  const connection = await pool.connect();
  let acquired = false;
  try {
    const result = await connection.query('SELECT pg_try_advisory_lock(721018243) AS acquired');
    acquired = result.rows[0].acquired;
    if (!acquired) throw new Error('Slack sync already running');
    return await run();
  } finally {
    try { if (acquired) await connection.query('SELECT pg_advisory_unlock(721018243)'); }
    finally { connection.release(); }
  }
}

export async function syncSlackAttendance() {
  const channel = process.env.SLACK_CHANNEL_ID;
  if (!channel || !process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL || !process.env.AUTH_SECRET) throw new Error('Slack sync is not configured');
  return withSlackSyncLock(async () => {
    const client = new SlackClient();
    const directory = await syncDirectory(client);
    await client.verifyChannel(channel);
    const now = new Date();
    const latest = (now.getTime() / 1000).toFixed(6);
    const oldest = (now.getTime() / 1000 - 45 * 86400).toFixed(6);
    const messages = await client.history(channel, oldest, latest);
    const identities = await db.select().from(slackIdentities).where(and(eq(slackIdentities.teamId, SLACK_TEAM_ID), eq(slackIdentities.active, true)));
    const stored = await db.select().from(slackMessages).where(eq(slackMessages.channelId, channel));
    const result = await reconcileAttendance({
      channel, oldest, latest, messages, hashSecret: process.env.AUTH_SECRET!,
      identities: new Map(identities.map(i => [i.slackUserId, i.userId])), stored,
      interpret: interpretAttendance,
      store: {
        async replace(message, userId, entries, updatedAt) {
          await db.transaction(async tx => {
            await tx.insert(slackMessages).values({ ...message, channelId: channel }).onConflictDoUpdate({
              target: slackMessages.key, set: { contentHash: message.contentHash, processedAt: new Date() },
            });
            await tx.delete(status).where(eq(status.slackMessageKey, message.key));
            if (entries.length) await tx.insert(status).values(entries.map((entry, index) => ({
              ...entry, userID: userId, slackMessageKey: message.key, sourceIndex: index, createdAt: updatedAt.toISOString(),
            })));
          });
        },
        async remove(keys) { await db.delete(slackMessages).where(inArray(slackMessages.key, keys)); },
      },
    });
    if (!result.failed) await db.insert(slackSyncState).values({ channelId: channel, completedAt: now }).onConflictDoUpdate({ target: slackSyncState.channelId, set: { completedAt: now } });
    return { ...result, directory };
  });
}
