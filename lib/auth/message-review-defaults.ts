const INITIAL_MESSAGE_REVIEWER = {
  teamId: 'T02HKL21R',
  slackUserId: 'U05NP1NF3QB',
};

export function isInitialMessageReviewer(teamId: string, slackUserId: string): boolean {
  return (
    teamId === INITIAL_MESSAGE_REVIEWER.teamId &&
    slackUserId === INITIAL_MESSAGE_REVIEWER.slackUserId
  );
}
