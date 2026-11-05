'use server';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { requireUserId } from '@/lib/auth/require-user';

/** Records that the signed-in person closed the phone app invitation, so it is never shown again. */
export async function dismissPhoneInviteAction() {
  const userId = await requireUserId();
  try {
    // Keeps the first dismissal if it is closed in two windows.
    await db
      .update(users)
      .set({ phoneInviteDismissedAt: sql`now()` })
      .where(and(eq(users.userId, userId), isNull(users.phoneInviteDismissedAt)));
    return { ok: true as const };
  } catch (error) {
    console.error(error);
    return { ok: false as const };
  }
}
