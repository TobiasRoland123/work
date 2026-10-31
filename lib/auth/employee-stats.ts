import { cache } from 'react';
import { and, eq, isNotNull, ne, or } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/db';
import { employeeStatsAccess, users } from '@/db/schema';
import { requireUserId } from '@/lib/auth/require-user';
import { isSandbox, SANDBOX_TEAM_ID } from '@/lib/sandbox/enabled';
import { ADMIN_SLACK_IDENTITY } from './admin-identity';

// The sandbox workspace has no real admin. Anna (see SANDBOX_FIXTURES) stands in, so the grant
// controls can be tried by signing in as the other sandbox profiles.
export const SANDBOX_ADMIN_SLACK_USER_ID = 'U_LOCAL_ANNA';

/** The Slack user who administers access in the configured workspace, if it has one. */
export function adminSlackUserId(teamId: string): string | null {
  if (isSandbox() && teamId === SANDBOX_TEAM_ID) return SANDBOX_ADMIN_SLACK_USER_ID;
  return teamId === ADMIN_SLACK_IDENTITY.teamId ? ADMIN_SLACK_IDENTITY.slackUserId : null;
}

/** An active, Slack-mapped member of the configured workspace. */
export function activeWorkspaceMember(teamId: string) {
  return and(
    eq(users.slackTeamId, teamId),
    eq(users.slackDeactivated, false),
    isNotNull(users.slackUserId),
    ne(users.slackUserId, '')
  );
}

// Both checks read the database on each request. A session claim cannot grant access.
export const isEmployeeStatsAdmin = cache(async (userId: string): Promise<boolean> => {
  const teamId = process.env.SLACK_TEAM_ID;
  if (!teamId) return false;
  const slackUserId = adminSlackUserId(teamId);
  if (!slackUserId) return false;

  const [admin] = await db
    .select({ userId: users.userId })
    .from(users)
    .where(
      and(
        eq(users.userId, userId),
        eq(users.slackUserId, slackUserId),
        activeWorkspaceMember(teamId)
      )
    )
    .limit(1);
  return Boolean(admin);
});

/** The admin always has access. Everyone else needs a grant from the admin. */
export const canViewEmployeeStats = cache(async (userId: string): Promise<boolean> => {
  const teamId = process.env.SLACK_TEAM_ID;
  if (!teamId) return false;
  const slackUserId = adminSlackUserId(teamId);

  const [viewer] = await db
    .select({ userId: users.userId })
    .from(users)
    .leftJoin(employeeStatsAccess, eq(employeeStatsAccess.userId, users.userId))
    .where(
      and(
        eq(users.userId, userId),
        activeWorkspaceMember(teamId),
        or(
          isNotNull(employeeStatsAccess.userId),
          slackUserId ? eq(users.slackUserId, slackUserId) : undefined
        )
      )
    )
    .limit(1);
  return Boolean(viewer);
});

async function sessionUserOrNotFound(): Promise<string> {
  try {
    return await requireUserId();
  } catch {
    notFound();
  }
}

export async function requireEmployeeStatsViewer(): Promise<string> {
  const userId = await sessionUserOrNotFound();
  if (!(await canViewEmployeeStats(userId))) notFound();
  return userId;
}

export async function requireEmployeeStatsAdmin(): Promise<string> {
  const userId = await sessionUserOrNotFound();
  if (!(await isEmployeeStatsAdmin(userId))) notFound();
  return userId;
}
