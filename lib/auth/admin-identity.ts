// Samuel Tobias Roland Uyet, the app admin, identified by the Slack identity the sign-in
// verified (email tru@charlietango.dk). The identity lives in code so no database row,
// profile edit or API call can make someone else an admin.
export const ADMIN_SLACK_IDENTITY = {
  teamId: 'T02HKL21R',
  slackUserId: 'U05NP1NF3QB',
} as const;
