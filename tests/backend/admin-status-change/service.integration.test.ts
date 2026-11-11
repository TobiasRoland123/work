import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db, pool } from '@/db';
import { adminStatusChanges, slackMessages, status, users } from '@/db/schema';
import { copenhagenWallClock } from '@/lib/status/active';
import { statusService } from '@/lib/services/statusService';

const team = 'TADMINCHG_' + randomUUID().slice(0, 8);
const channel = 'CADMINCHG';
const admin = randomUUID();
const colleague = randomUUID();
const revision = '1793000000.123456';
const messageKey = `${team}:${channel}:${revision}`;

describe.runIf(process.env.SLACK_TEST_DATABASE === '1')(
  'admin status changes on isolated PostgreSQL',
  () => {
    let importedId: number;

    beforeAll(async () => {
      if (process.env.PGHOST !== '127.0.0.1' || process.env.PGDATABASE !== 'work_slack_test')
        throw new Error('Dedicated local test database required');
      await db.insert(users).values(
        [admin, colleague].map((userId, index) => ({
          userId,
          email: userId + '@example.com',
          slackTeamId: team,
          slackUserId: 'UADMINCHG' + index,
        }))
      );
      await db.insert(slackMessages).values({
        messageKey,
        teamId: team,
        channelId: channel,
        messageTs: revision,
        revision,
        state: 'applied',
        convertedToStatus: true,
        outcome: { reason: 'clear' },
      });
      const [row] = await db
        .insert(status)
        .values({
          userID: colleague,
          status: 'AWAY',
          details: 'Workshop@NNI',
          fromDate: '2026-11-05',
          toDate: '2026-11-06',
          startsAt: copenhagenWallClock('2026-11-05', 0, 0),
          endsAt: copenhagenWallClock('2026-11-07', 0, 0),
          sourceMessageKey: messageKey,
          createdAt: new Date(Number(revision) * 1000).toISOString(),
          announcedAt: new Date(Number(revision) * 1000),
        })
        .returning({ id: status.id });
      importedId = row.id;
    });

    afterAll(async () => {
      await db.delete(slackMessages).where(eq(slackMessages.teamId, team));
      await db.delete(users).where(inArray(users.userId, [admin, colleague]));
      await pool.end();
    });

    it('saves the Declaration and records the imported status it overwrote', async () => {
      const [declaration] = await statusService.createColleagueStatuses(admin, colleague, [
        {
          status: 'AT_CLIENT',
          details: 'NNI',
          fromDate: '2026-11-05',
          toDate: '2026-11-05',
          time: null,
        },
      ]);
      expect(declaration).toMatchObject({ userID: colleague, status: 'AT_CLIENT' });

      const [record] = await db
        .select()
        .from(adminStatusChanges)
        .where(eq(adminStatusChanges.userId, colleague));
      expect(record).toMatchObject({
        adminUserId: admin,
        statusId: declaration.id,
        status: 'AT_CLIENT',
        details: 'NNI',
        fromDate: '2026-11-05',
        toDate: '2026-11-05',
        overridesImport: true,
        replaced: [
          {
            statusId: importedId,
            status: 'AWAY',
            details: 'Workshop@NNI',
            sourceMessageKey: messageKey,
            sourceRevision: revision,
            fromDay: '2026-11-05',
            toDay: '2026-11-05',
          },
        ],
      });
    });

    it('keeps the record when the admin account is removed', async () => {
      await db.delete(users).where(eq(users.userId, admin));
      const rows = await db
        .select()
        .from(adminStatusChanges)
        .where(eq(adminStatusChanges.userId, colleague));
      expect(rows).toHaveLength(1);
      expect(rows[0].adminUserId).toBeNull();
    });
  }
);
