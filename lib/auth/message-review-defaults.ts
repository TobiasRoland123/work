import { ADMIN_SLACK_IDENTITY } from './admin-identity';

export function isInitialAdmin(teamId: string, slackUserId: string): boolean {
  return teamId === ADMIN_SLACK_IDENTITY.teamId && slackUserId === ADMIN_SLACK_IDENTITY.slackUserId;
}

// Kept for older callers; initial reviewer grants have been replaced by the admin role.
export const isInitialMessageReviewer = isInitialAdmin;
