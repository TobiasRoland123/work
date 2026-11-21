/** Runtime deployment switch. Unknown values fail closed; never expose credentials to clients. */
export function slackEchoWritesEnabled() {
  const mode = process.env.SLACK_HISTORY_IMPORT_MODE?.trim();
  return !mode || mode === 'off';
}

export const IMPORT_STATUS_UNAVAILABLE =
  'Status changes are temporarily unavailable while Slack Echo is paused for the historical import. You can still announce attendance in Slack.';

export function assertManualStatusWritesEnabled() {
  if (!slackEchoWritesEnabled()) throw new Error(IMPORT_STATUS_UNAVAILABLE);
}
