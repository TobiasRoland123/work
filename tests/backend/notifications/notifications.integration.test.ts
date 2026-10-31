import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db, pool } from '@/db';
import {
  notificationPreferences,
  pinnedColleagues,
  pushSubscriptions,
  status,
  users,
} from '@/db/schema';

const push = vi.hoisted(() => ({ sendPush: vi.fn(), pushConfigured: vi.fn(() => true) }));
vi.mock('@/lib/notifications/push', () => push);

import { notificationService } from '@/lib/services/notificationService';

const team = 'TPUSH_' + randomUUID().slice(0, 8);
const [me, marie, peter] = [randomUUID(), randomUUID(), randomUUID()];
const everyone = [me, marie, peter];
const names: Record<string, string> = { [me]: 'Me', [marie]: 'Marie', [peter]: 'Peter' };
const endpoint = (userId: string) => `https://push.example.com/${userId}`;

// Wednesday 2026-03-04, 11:00 Copenhagen
const noon = new Date('2026-03-04T10:00:00Z');
const homeToday = {
  fromDate: '2026-03-04',
  toDate: '2026-03-04',
  announcedAt: new Date('2026-03-04T06:00:00Z'),
  createdAt: '2026-03-04T06:00:00.000Z',
};

describe.runIf(process.env.SLACK_TEST_DATABASE === '1')(
  'push notifications on isolated PostgreSQL',
  () => {
    beforeAll(async () => {
      if (process.env.PGHOST !== '127.0.0.1' || process.env.PGDATABASE !== 'work_slack_test')
        throw new Error('Dedicated local test database required');
      await db.insert(users).values(
        everyone.map((userId, index) => ({
          userId,
          firstName: names[userId],
          email: userId + '@example.com',
          slackTeamId: team,
          slackUserId: 'UPUSH' + index,
        }))
      );
    });

    beforeEach(async () => {
      await db.delete(status).where(inArray(status.userID, everyone));
      await db.delete(pinnedColleagues).where(inArray(pinnedColleagues.userId, everyone));
      await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.userId, everyone));
      await db
        .update(users)
        .set({ slackDeactivated: false })
        .where(inArray(users.userId, everyone));
      push.pushConfigured.mockReset().mockReturnValue(true);
      push.sendPush.mockReset().mockResolvedValue('sent');
      for (const userId of everyone)
        await notificationService.setPreference(userId, 'pinned_arrived', true);
      for (const userId of everyone)
        await notificationService.setPreference(userId, 'pinned_in_today', true);
    });

    afterAll(async () => {
      await db.delete(users).where(inArray(users.userId, everyone));
      await pool.end();
    });

    const subscribe = (userId: string) =>
      notificationService.subscribe(userId, { endpoint: endpoint(userId), p256dh: 'k', auth: 'a' });
    const pin = (userId: string, colleagueUserId: string) =>
      db.insert(pinnedColleagues).values({ userId, colleagueUserId });
    const announce = async (userID: string, row: Partial<typeof status.$inferInsert>) => {
      await db.insert(status).values({ userID, status: 'IN_OFFICE', ...homeToday, ...row });
    };
    const statusesOf = (userId: string) =>
      db.select().from(status).where(eq(status.userID, userId));

    it('defaults every type on and keeps an explicit choice', async () => {
      await db
        .delete(notificationPreferences)
        .where(inArray(notificationPreferences.userId, everyone));
      expect(await notificationService.getPreferences(me)).toEqual({
        pinned_arrived: true,
        pinned_in_today: true,
      });
      await notificationService.setPreference(me, 'pinned_arrived', false);
      expect(await notificationService.getPreferences(me)).toEqual({
        pinned_arrived: false,
        pinned_in_today: true,
      });
    });

    it('keeps one row per browser, moving it to whoever is signed in', async () => {
      await subscribe(me);
      await notificationService.subscribe(marie, {
        endpoint: endpoint(me),
        p256dh: 'k2',
        auth: 'a2',
      });
      const rows = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, endpoint(me)));
      expect(rows).toHaveLength(1);
      expect(rows[0].userId).toBe(marie);
      await notificationService.unsubscribe(me, endpoint(me));
      expect(
        await db
          .select()
          .from(pushSubscriptions)
          .where(eq(pushSubscriptions.endpoint, endpoint(me)))
      ).toHaveLength(1);
    });

    it('tells people who pinned a colleague when a Declaration brings them to the office', async () => {
      await pin(me, marie);
      await subscribe(me);
      await announce(marie, { status: 'FROM_HOME' });
      const before = await statusesOf(marie);
      await announce(marie, { announcedAt: new Date('2026-03-04T09:30:00Z') });

      expect(await notificationService.notifyArrival(marie, before, noon)).toBe(1);
      expect(push.sendPush).toHaveBeenCalledWith(
        expect.objectContaining({ endpoint: endpoint(me) }),
        expect.objectContaining({ title: 'Marie arrived', url: '/today' })
      );
    });

    it('does not tell people who did not pin them, opted out, or are deactivated', async () => {
      await subscribe(me);
      await subscribe(peter);
      await pin(peter, marie);
      await announce(marie, { status: 'FROM_HOME' });
      const before = await statusesOf(marie);
      await announce(marie, { announcedAt: new Date('2026-03-04T09:30:00Z') });

      // me never pinned Marie; peter opts out
      await notificationService.setPreference(peter, 'pinned_arrived', false);
      expect(await notificationService.notifyArrival(marie, before, noon)).toBe(0);

      await notificationService.setPreference(peter, 'pinned_arrived', true);
      await db.update(users).set({ slackDeactivated: true }).where(eq(users.userId, peter));
      expect(await notificationService.notifyArrival(marie, before, noon)).toBe(0);
      expect(push.sendPush).not.toHaveBeenCalled();
    });

    it('does nothing when push is not configured, and forgets expired devices', async () => {
      await pin(me, marie);
      await subscribe(me);
      await announce(marie, { status: 'FROM_HOME' });
      const before = await statusesOf(marie);
      await announce(marie, { announcedAt: new Date('2026-03-04T09:30:00Z') });

      push.pushConfigured.mockReturnValue(false);
      expect(await notificationService.notifyArrival(marie, before, noon)).toBe(0);

      push.pushConfigured.mockReturnValue(true);
      push.sendPush.mockResolvedValue('gone');
      expect(await notificationService.notifyArrival(marie, before, noon)).toBe(0);
      expect(
        await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, me))
      ).toHaveLength(0);
    });

    it('sends the morning summary of pinned colleagues who are in today', async () => {
      await pin(me, marie);
      await pin(me, peter);
      await subscribe(me);
      await announce(peter, { status: 'FROM_HOME' });

      expect(await notificationService.sendPinnedDigest(noon)).toBe(1);
      const [, payload] = push.sendPush.mock.calls[0];
      expect(payload).toMatchObject({
        title: 'Pinned colleagues in today',
        body: 'In the office: Marie.',
      });

      push.sendPush.mockClear();
      await notificationService.setPreference(me, 'pinned_in_today', false);
      expect(await notificationService.sendPinnedDigest(noon)).toBe(0);
      expect(push.sendPush).not.toHaveBeenCalled();
    });
  }
);
