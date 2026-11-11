import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db, pool } from '@/db';
import { slackMessages, status, users } from '@/db/schema';
import { withStatusAttribution } from '@/lib/services/statusAttribution';
import { statusService } from '@/lib/services/statusService';
import { userService } from '@/lib/services/userService';

const team = 'TATTRIBUTION';
const authorId = randomUUID();
const recipientId = randomUUID();
const otherTeamId = randomUUID();
const ids = [authorId, recipientId, otherTeamId];
const key = `${team}:C:123`;

describe.runIf(process.env.SLACK_TEST_DATABASE === '1')('shared announcement attribution', () => {
  beforeAll(async () => {
    if (process.env.PGHOST !== '127.0.0.1' || process.env.PGDATABASE !== 'work_slack_test')
      throw new Error('Dedicated local test database required');
    await db.insert(users).values([
      {
        userId: authorId,
        email: `${authorId}@example.com`,
        firstName: 'Ulla',
        lastName: null,
        slackTeamId: team,
        slackUserId: 'UAUTHOR',
      },
      {
        userId: recipientId,
        email: `${recipientId}@example.com`,
        slackTeamId: team,
        slackUserId: 'URECIPIENT',
      },
      {
        userId: otherTeamId,
        email: `${otherTeamId}@example.com`,
        firstName: 'Wrong workspace',
        slackTeamId: 'TOTHERATTRIBUTION',
        slackUserId: 'UMISSING',
      },
    ]);
    await db
      .insert(slackMessages)
      .values({
        messageKey: key,
        teamId: team,
        channelId: 'C',
        messageTs: '123',
        revision: '123',
        slackUserId: 'UAUTHOR',
        state: 'applied',
      });
    await db
      .insert(status)
      .values(
        ids
          .slice(0, 2)
          .map((userID) => ({
            userID,
            status: 'AT_CLIENT' as const,
            sourceMessageKey: key,
            fromDate: '2026-11-05',
            toDate: '2026-11-05',
          }))
      );
  });
  afterAll(async () => {
    await db.delete(status).where(inArray(status.userID, ids));
    await db.delete(slackMessages).where(eq(slackMessages.messageKey, key));
    await db.delete(users).where(inArray(users.userId, ids));
    await pool.end();
  });
  it('attributes only the recipient and carries metadata into week and plan reads', async () => {
    const rows = await withStatusAttribution(
      await db.select().from(status).where(inArray(status.userID, ids))
    );
    expect(rows.find((row) => row.userID === authorId)?.sourceAuthor).toBeUndefined();
    expect(rows.find((row) => row.userID === recipientId)?.sourceAuthor).toEqual({ name: 'Ulla' });
    expect((await statusService.getStatusByUserUserId(recipientId))[0].sourceAuthor).toEqual({
      name: 'Ulla',
    });
    const profiles = await userService.getAllUsers(false, ['2026-11-05']);
    expect(
      profiles.find((profile) => profile.userId === recipientId)?.week?.[0].announcement
        ?.sourceAuthor
    ).toEqual({ name: 'Ulla' });
  });
  it('uses a colleague fallback when the source author is missing and never matches another workspace', async () => {
    await db
      .update(slackMessages)
      .set({ slackUserId: 'UMISSING' })
      .where(eq(slackMessages.messageKey, key));
    const [row] = await statusService.getStatusByUserUserId(recipientId);
    expect(row.sourceAuthor).toEqual({ name: null });
  });
  it('does not attribute manual declarations', async () => {
    const [manual] = await db
      .insert(status)
      .values({ userID: recipientId, status: 'FROM_HOME' })
      .returning();
    expect(await withStatusAttribution([manual])).toEqual([manual]);
  });
});
