import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db, pool } from '@/db';
import { users } from '@/db/schema';

const auth = vi.hoisted(() => ({ requireUserId: vi.fn() }));
vi.mock('@/lib/auth/require-user', () => ({ requireUserId: auth.requireUserId }));

import { dismissPhoneInviteAction } from '@/app/actions/phoneInviteActions';

const team = 'TPHONE_' + randomUUID().slice(0, 8);
const [me, marie] = [randomUUID(), randomUUID()];
const everyone = [me, marie];

const dismissedAt = async (userId: string) => {
  const [row] = await db
    .select({ at: users.phoneInviteDismissedAt })
    .from(users)
    .where(eq(users.userId, userId));
  return row.at;
};

describe.runIf(process.env.SLACK_TEST_DATABASE === '1')(
  'phone app invitation dismissal on isolated PostgreSQL',
  () => {
    beforeAll(async () => {
      if (process.env.PGHOST !== '127.0.0.1' || process.env.PGDATABASE !== 'work_slack_test')
        throw new Error('Dedicated local test database required');
      await db.insert(users).values(
        everyone.map((userId, index) => ({
          userId,
          email: userId + '@example.com',
          slackTeamId: team,
          slackUserId: 'UPHONE' + index,
        }))
      );
    });

    beforeEach(async () => {
      await db
        .update(users)
        .set({ phoneInviteDismissedAt: null })
        .where(inArray(users.userId, everyone));
      auth.requireUserId.mockReset().mockResolvedValue(me);
    });

    afterAll(async () => {
      await db.delete(users).where(inArray(users.userId, everyone));
      await pool.end();
    });

    it('starts undismissed for everyone', async () => {
      expect(await dismissedAt(me)).toBeNull();
    });

    it('records the dismissal only for the signed-in person', async () => {
      expect(await dismissPhoneInviteAction()).toEqual({ ok: true });

      expect(await dismissedAt(me)).not.toBeNull();
      expect(await dismissedAt(marie)).toBeNull();
    });

    it('keeps the first dismissal when it is closed again', async () => {
      await dismissPhoneInviteAction();
      const first = await dismissedAt(me);
      await new Promise((resolve) => setTimeout(resolve, 20));
      await dismissPhoneInviteAction();

      expect(await dismissedAt(me)).toEqual(first);
    });
  }
);
