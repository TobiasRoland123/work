// The Local Sandbox replaces the Slack workspace during local development.
// Profile sign-in stays local; hosted sandbox access is checked per account on the server.

/** Identifiers of the sandbox workspace. Nothing in the sandbox contacts Slack. */
export const SANDBOX_TEAM_ID = 'T_LOCAL';
export const SANDBOX_CHANNEL_ID = 'C_LOCAL';

export function isSandbox() {
  return process.env.NODE_ENV !== 'production';
}

export function isLocalSandbox() {
  return isSandbox() && process.env.SLACK_TEAM_ID === SANDBOX_TEAM_ID;
}

export function assertSandbox() {
  if (!isLocalSandbox())
    throw new Error('Sandbox profile sign-in is disabled outside the local workspace');
}
