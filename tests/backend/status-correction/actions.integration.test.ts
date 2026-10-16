import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db, pool } from '@/db';
import { slackMessages, status, statusCorrections, users } from '@/db/schema';
import { copenhagenWallClock } from '@/lib/status/active';
import { resolveWorkWeek } from '@/lib/status/week';

const auth = vi.hoisted(() => ({ requireUserId: vi.fn() }));
vi.mock('@/lib/auth/require-user', () => ({ requireUserId: auth.requireUserId }));

import { correctImportedStatusAction } from '@/app/actions/statusActions';

const team = 'TCORRECT_' + randomUUID().slice(0, 8);
const channel = 'CCORRECT';
const owner = randomUUID();
const other = randomUUID();
const revision = '1790000000.123456';
const messageKey = team + ':' + channel + ':' + revision;
const days = ['2026-09-21', '2026-09-22', '2026-09-23'];
let importedId: number;

const corrections = () =>
  db.select().from(statusCorrections).where(eq(statusCorrections.sourceMessageKey, messageKey));
const userDeclarations = () =>
  db
    .select()
    .from(status)
    .where(and(eq(status.userID, owner), isNull(status.sourceMessageKey)));
const correct = (input: object = {}) =>
  correctImportedStatusAction({
    statusId: importedId,
    day: '2026-09-22',
    scope: 'day',
    status: 'SICK',
    ...input,
  });

describe.runIf(process.env.SLACK_TEST_DATABASE === '1')(
  'imported status correction on isolated PostgreSQL',
  () => {
    beforeAll(async () => {
      if (process.env.PGHOST !== '127.0.0.1' || process.env.PGDATABASE !== 'work_slack_test')
        throw new Error('Dedicated local test database required');
      await db.insert(users).values(
        [owner, other].map((userId, index) => ({
          userId,
          email: userId + '@example.com',
          slackTeamId: team,
          slackUserId: 'UCORRECT' + index,
        }))
      );
    });

    beforeEach(async () => {
      await db.delete(statusCorrections).where(inArray(statusCorrections.userId, [owner, other]));
      await db.delete(status).where(inArray(status.userID, [owner, other]));
      await db.delete(slackMessages).where(eq(slackMessages.teamId, team));
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
      // Written the way the inbox writes an imported Declaration.
      const [row] = await db
        .insert(status)
        .values({
          userID: owner,
          status: 'FROM_HOME',
          details: 'hjemme resten af ugen',
          fromDate: days[0],
          toDate: days[2],
          startsAt: copenhagenWallClock(days[0], 0, 0),
          endsAt: copenhagenWallClock('2026-09-24', 0, 0),
          time: null,
          sourceMessageKey: messageKey,
          createdAt: new Date(Number(revision) * 1000).toISOString(),
          announcedAt: new Date(Number(revision) * 1000),
        })
        .returning({ id: status.id });
      importedId = row.id;
      auth.requireUserId.mockReset().mockResolvedValue(owner);
    });

    afterAll(async () => {
      await db.delete(slackMessages).where(eq(slackMessages.teamId, team));
      await db.delete(users).where(inArray(users.userId, [owner, other]));
      await pool.end();
    });

    it('applies a day correction and records the error without touching the import', async () => {
      await expect(correct()).resolves.toEqual({ ok: true, duplicate: false });

      const [original] = await db.select().from(status).where(eq(status.id, importedId));
      expect(original).toMatchObject({
        status: 'FROM_HOME',
        details: 'hjemme resten af ugen',
        sourceMessageKey: messageKey,
      });
      const [declaration] = await userDeclarations();
      expect(declaration).toMatchObject({
        status: 'SICK',
        details: null,
        fromDate: '2026-09-22',
        toDate: '2026-09-22',
      });
      const [record] = await corrections();
      expect(record).toMatchObject({
        userId: owner,
        originalStatusId: importedId,
        correctionStatusId: declaration.id,
        sourceRevision: revision,
        originalStatus: 'FROM_HOME',
        originalDetails: 'hjemme resten af ugen',
        correctedStatus: 'SICK',
        fromDate: '2026-09-22',
        toDate: '2026-09-22',
      });
      expect(record.createdAt).toBeInstanceOf(Date);

      const rows = await db.select().from(status).where(eq(status.userID, owner));
      expect(resolveWorkWeek(rows, owner, days).map((day) => day.status?.status)).toEqual([
        'FROM_HOME',
        'SICK',
        'FROM_HOME',
      ]);
    });

    it('can correct the whole imported interval', async () => {
      await expect(correct({ scope: 'declaration', status: 'AT_CLIENT' })).resolves.toMatchObject({
        ok: true,
      });
      const rows = await db.select().from(status).where(eq(status.userID, owner));
      expect(resolveWorkWeek(rows, owner, days).map((day) => day.status?.status)).toEqual([
        'AT_CLIENT',
        'AT_CLIENT',
        'AT_CLIENT',
      ]);
      const [record] = await corrections();
      expect(record).toMatchObject({ fromDate: days[0], toDate: days[2] });
    });

    it('does not duplicate repeated or concurrent submissions', async () => {
      const results = await Promise.all([correct(), correct()]);
      expect(results.map((result) => result.ok)).toEqual([true, true]);
      await expect(correct()).resolves.toEqual({ ok: true, duplicate: true });
      await expect(corrections()).resolves.toHaveLength(1);
      await expect(userDeclarations()).resolves.toHaveLength(1);
    });

    it('re-applies a repeated correction after the person removed it', async () => {
      await correct();
      const [removed] = await userDeclarations();
      await db.delete(status).where(eq(status.id, removed.id));

      await expect(correct()).resolves.toEqual({ ok: true, duplicate: true });
      const [declaration] = await userDeclarations();
      const records = await corrections();
      expect(records).toHaveLength(1);
      expect(records[0].correctionStatusId).toBe(declaration.id);
    });

    it('enforces ownership and only corrects imported Declarations', async () => {
      auth.requireUserId.mockResolvedValue(other);
      await expect(correct()).resolves.toMatchObject({ ok: false });

      auth.requireUserId.mockResolvedValue(owner);
      const [manual] = await db
        .insert(status)
        .values({ userID: owner, status: 'FROM_HOME', fromDate: days[1], toDate: days[1] })
        .returning({ id: status.id });
      await expect(correct({ statusId: manual.id })).resolves.toMatchObject({ ok: false });
      await expect(correct({ day: '2026-09-24' })).resolves.toMatchObject({ ok: false });
      await expect(correct({ status: 'FROM_HOME' })).resolves.toMatchObject({ ok: false });
      await expect(corrections()).resolves.toHaveLength(0);
    });

    it('omits the revision when a later revision left the import in place', async () => {
      await db
        .update(slackMessages)
        .set({ revision: '1790000300.000001', state: 'review' })
        .where(eq(slackMessages.messageKey, messageKey));
      await expect(correct()).resolves.toMatchObject({ ok: true });
      const [record] = await corrections();
      expect(record.sourceRevision).toBeNull();
    });
  }
);
