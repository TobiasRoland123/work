const INITIAL_PRIVILEGED_ACCOUNT = {
  teamId: 'T02HKL21R',
  slackUserId: 'U05NP1NF3QB',
};

export function isInitialPrivilegedAccount(teamId: string, slackUserId: string): boolean {
  return (
    teamId === INITIAL_PRIVILEGED_ACCOUNT.teamId &&
    slackUserId === INITIAL_PRIVILEGED_ACCOUNT.slackUserId
  );
}
