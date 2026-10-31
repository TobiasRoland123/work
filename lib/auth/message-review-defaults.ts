import { ADMIN_SLACK_IDENTITY } from './admin-identity';

export function isInitialMessageReviewer(teamId: string, slackUserId: string): boolean {
  return teamId === ADMIN_SLACK_IDENTITY.teamId && slackUserId === ADMIN_SLACK_IDENTITY.slackUserId;
}
