import { cache } from 'react';
import { notFound } from 'next/navigation';
import { requireUserId } from '@/lib/auth/require-user';
import { isSandbox, SANDBOX_TEAM_ID } from '@/lib/sandbox/enabled';
import { ADMIN_SLACK_IDENTITY } from './admin-identity';
import { getUserRole, isAdmin } from './roles';

// The sandbox workspace has no real admin. Anna (see SANDBOX_FIXTURES) stands in, so the grant
// controls can be tried by signing in as the other sandbox profiles.
export const SANDBOX_ADMIN_SLACK_USER_ID = 'U_LOCAL_ANNA';

/** Initial admin identity only. Runtime permissions always use the stored role. */
export function adminSlackUserId(teamId: string): string | null {
  if (isSandbox() && teamId === SANDBOX_TEAM_ID) return SANDBOX_ADMIN_SLACK_USER_ID;
  return teamId === ADMIN_SLACK_IDENTITY.teamId ? ADMIN_SLACK_IDENTITY.slackUserId : null;
}

// Stats are available to managers and admins. Neither legacy grants nor a Slack identity
// bypass the stored role after the initial admin has been bootstrapped.
export const isEmployeeStatsAdmin = isAdmin;
export { activeWorkspaceMember } from './roles';

export const canViewEmployeeStats = cache(async (userId: string): Promise<boolean> => {
  const role = await getUserRole(userId);
  return role === 'ADMIN' || role === 'MANAGER';
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
