import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { pinnedColleagues, users } from '@/db/schema';

export class PinError extends Error {}

export const pinService = {
  /** Colleagues a person pinned, oldest first. Deactivated colleagues stay stored but are hidden. */
  async listPinnedIds(userId: string) {
    const rows = await db
      .select({ colleagueUserId: pinnedColleagues.colleagueUserId })
      .from(pinnedColleagues)
      .innerJoin(users, eq(users.userId, pinnedColleagues.colleagueUserId))
      .where(and(eq(pinnedColleagues.userId, userId), eq(users.slackDeactivated, false)))
      .orderBy(asc(pinnedColleagues.createdAt));
    return rows.map((row) => row.colleagueUserId);
  },

  /** Pinning someone twice is a no-op. */
  async pin(userId: string, colleagueUserId: string) {
    if (userId === colleagueUserId) throw new PinError('You cannot pin yourself.');
    const [colleague] = await db
      .select({ slackDeactivated: users.slackDeactivated })
      .from(users)
      .where(eq(users.userId, colleagueUserId))
      .limit(1);
    if (!colleague || colleague.slackDeactivated)
      throw new PinError('That colleague was not found.');
    await db.insert(pinnedColleagues).values({ userId, colleagueUserId }).onConflictDoNothing();
  },

  async unpin(userId: string, colleagueUserId: string) {
    await db
      .delete(pinnedColleagues)
      .where(
        and(
          eq(pinnedColleagues.userId, userId),
          eq(pinnedColleagues.colleagueUserId, colleagueUserId)
        )
      );
  },
};
