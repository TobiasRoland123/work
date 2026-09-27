import { cache } from 'react';
import { and, eq, isNotNull, ne } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/db';
import { users } from '@/db/schema';
import { requireUserId } from '@/lib/auth/require-user';
import { isSandbox, SANDBOX_TEAM_ID } from '@/lib/sandbox/enabled';

// Read the current database permission on each request. A session claim cannot grant access.
export const canReviewMessages = cache(async (userId: string): Promise<boolean> => {
  const teamId = process.env.SLACK_TEAM_ID;
  if (!teamId) return false;
  const sandboxWorkspace = isSandbox() && teamId === SANDBOX_TEAM_ID;

  const [reviewer] = await db
    .select({ userId: users.userId })
    .from(users)
    .where(
      and(
        eq(users.userId, userId),
        sandboxWorkspace ? undefined : eq(users.canReviewMessages, true),
        eq(users.slackTeamId, teamId),
        eq(users.slackDeactivated, false),
        isNotNull(users.slackUserId),
        ne(users.slackUserId, '')
      )
    )
    .limit(1);
  return Boolean(reviewer);
});

export async function requireMessageReviewer(): Promise<string> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    notFound();
  }
  if (!(await canReviewMessages(userId))) notFound();
  return userId;
}
