import { cache } from 'react';
import { and, eq, isNotNull, ne } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/db';
import { users } from '@/db/schema';
import { requireUserId } from './require-user';
import { isAppRole, type AppRole } from './role-policy';

/** Only an active, Slack-mapped member of the configured workspace can have access. */
export function activeWorkspaceMember(teamId: string) {
  return and(
    eq(users.slackTeamId, teamId),
    eq(users.slackDeactivated, false),
    isNotNull(users.slackUserId),
    ne(users.slackUserId, '')
  );
}

// Request-scoped caching shares the lookup within a render. Role changes and deactivation
// take effect on the next request, without waiting for a session token to expire.
export const getUserRole = cache(async (userId: string): Promise<AppRole | null> => {
  const teamId = process.env.SLACK_TEAM_ID;
  if (!teamId) return null;
  const [member] = await db
    .select({ role: users.systemRole })
    .from(users)
    .where(and(eq(users.userId, userId), activeWorkspaceMember(teamId)))
    .limit(1);
  return member && isAppRole(member.role) ? member.role : null;
});

export const isAdmin = cache(async (userId: string): Promise<boolean> => {
  return (await getUserRole(userId)) === 'ADMIN';
});

export async function requireAdmin(): Promise<string> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    notFound();
  }
  if (!(await isAdmin(userId))) notFound();
  return userId;
}
