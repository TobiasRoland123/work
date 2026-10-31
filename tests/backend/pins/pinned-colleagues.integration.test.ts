import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db, pool } from '@/db';
import { pinnedColleagues, users } from '@/db/schema';
import { pinService } from '@/lib/services/pinService';

const auth = vi.hoisted(() => ({ requireUserId: vi.fn() }));
vi.mock('@/lib/auth/require-user', () => ({ requireUserId: auth.requireUserId }));

import { pinColleagueAction, unpinColleagueAction } from '@/app/actions/pinActions';

const team = 'TPINS_' + randomUUID().slice(0, 8);
const [me, marie, peter, lars] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const everyone = [me, marie, peter, lars];

const pinsOf = (userId: string) =>
  db.select().from(pinnedColleagues).where(eq(pinnedColleagues.userId, userId));
const deactivate = (userId: string, slackDeactivated: boolean) =>
  db.update(users).set({ slackDeactivated }).where(eq(users.userId, userId));

describe.runIf(process.env.SLACK_TEST_DATABASE === '1')(
  'pinned colleagues on isolated PostgreSQL',
  () => {
    beforeAll(async () => {
      if (process.env.PGHOST !== '127.0.0.1' || process.env.PGDATABASE !== 'work_slack_test')
        throw new Error('Dedicated local test database required');
      await db.insert(users).values(
        everyone.map((userId, index) => ({
          userId,
          email: userId + '@example.com',
          slackTeamId: team,
          slackUserId: 'UPINS' + index,
        }))
      );
    });

    beforeEach(async () => {
      await db.delete(pinnedColleagues).where(inArray(pinnedColleagues.userId, everyone));
      await db
        .update(users)
        .set({ slackDeactivated: false })
        .where(inArray(users.userId, everyone));
      auth.requireUserId.mockReset().mockResolvedValue(me);
    });

    afterAll(async () => {
      await db.delete(users).where(inArray(users.userId, everyone));
      await pool.end();
    });

    it('keeps pins in the order they were made', async () => {
      await pinColleagueAction(peter);
      await pinColleagueAction(marie);

      expect(await pinService.listPinnedIds(me)).toEqual([peter, marie]);
    });

    it('treats pinning someone twice as a no-op', async () => {
      expect(await pinColleagueAction(marie)).toEqual({ ok: true });
      expect(await pinColleagueAction(marie)).toEqual({ ok: true });

      expect(await pinService.listPinnedIds(me)).toEqual([marie]);
    });

    it('keeps each person’s pins private', async () => {
      await pinColleagueAction(marie);
      auth.requireUserId.mockResolvedValue(peter);
      await pinColleagueAction(lars);

      expect(await pinService.listPinnedIds(me)).toEqual([marie]);
      expect(await pinService.listPinnedIds(peter)).toEqual([lars]);
    });

    it('refuses to pin yourself', async () => {
      expect(await pinColleagueAction(me)).toEqual({
        ok: false,
        error: 'You cannot pin yourself.',
      });

      expect(await pinsOf(me)).toEqual([]);
    });

    it.each([randomUUID(), ''])('refuses to pin an unknown colleague %j', async (unknown) => {
      expect(await pinColleagueAction(unknown)).toEqual({
        ok: false,
        error: 'That colleague was not found.',
      });
    });

    it('refuses to pin a deactivated colleague', async () => {
      await deactivate(marie, true);

      expect(await pinColleagueAction(marie)).toMatchObject({ ok: false });
      expect(await pinsOf(me)).toEqual([]);
    });

    it('hides a pinned colleague who is later deactivated, and shows them again if reactivated', async () => {
      await pinColleagueAction(marie);
      await pinColleagueAction(peter);
      await deactivate(marie, true);

      expect(await pinService.listPinnedIds(me)).toEqual([peter]);

      await deactivate(marie, false);
      expect(await pinService.listPinnedIds(me)).toEqual([marie, peter]);
    });

    it('unpins only the signed-in person’s pin, and is harmless when nothing is pinned', async () => {
      await pinColleagueAction(marie);
      auth.requireUserId.mockResolvedValue(peter);
      await pinColleagueAction(marie);

      expect(await unpinColleagueAction(marie)).toEqual({ ok: true });
      expect(await unpinColleagueAction(marie)).toEqual({ ok: true });

      expect(await pinService.listPinnedIds(peter)).toEqual([]);
      expect(await pinService.listPinnedIds(me)).toEqual([marie]);
    });

    it('does not let the database store a self-pin', async () => {
      await expect(
        db.insert(pinnedColleagues).values({ userId: me, colleagueUserId: me })
      ).rejects.toThrow();
    });

    it('drops pins made by or of a person who is removed', async () => {
      const temporary = randomUUID();
      await db.insert(users).values({
        userId: temporary,
        email: temporary + '@example.com',
        slackTeamId: team,
        slackUserId: 'UPINSTMP',
      });
      await pinColleagueAction(temporary);
      auth.requireUserId.mockResolvedValue(temporary);
      await pinColleagueAction(peter);
      expect(await pinsOf(temporary)).toHaveLength(1);

      await db.delete(users).where(eq(users.userId, temporary));

      expect(await pinsOf(me)).toEqual([]);
      expect(await pinsOf(temporary)).toEqual([]);
    });

    it('refuses signed-out callers', async () => {
      auth.requireUserId.mockRejectedValue(new Error('Unauthorized'));

      await expect(pinColleagueAction(marie)).rejects.toThrow('Unauthorized');
      await expect(unpinColleagueAction(marie)).rejects.toThrow('Unauthorized');
    });
  }
);
