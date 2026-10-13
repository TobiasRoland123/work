import { cache } from 'react';
import { and, eq, isNotNull, ne } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/db';
import { users } from '@/db/schema';
import { requireUserId } from '@/lib/auth/require-user';
import { isLocalSandbox } from '@/lib/sandbox/enabled';

export const canUseSandbox = cache(async (userId: string): Promise<boolean> => {
  if (isLocalSandbox()) return true;
  const teamId = process.env.SLACK_TEAM_ID;
  if (!teamId) return false;
  const [operator] = await db
    .select({ userId: users.userId })
    .from(users)
    .where(
      and(
        eq(users.userId, userId),
        eq(users.canUseSandbox, true),
        eq(users.slackTeamId, teamId),
        eq(users.slackDeactivated, false),
        isNotNull(users.slackUserId),
        ne(users.slackUserId, '')
      )
    )
    .limit(1);
  return Boolean(operator);
});

// Local development still allows composing messages before signing in.
// Hosted pages and every server action require a current database grant.
export async function requireSandboxAccess(): Promise<void> {
  if (isLocalSandbox()) return;
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    notFound();
  }
  if (!(await canUseSandbox(userId))) notFound();
}
