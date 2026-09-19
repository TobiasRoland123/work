// The Local Sandbox replaces the Slack workspace during local development.
// NODE_ENV is the only switch: a production build never enables it.

/** Identifiers of the sandbox workspace. Nothing in the sandbox contacts Slack. */
export const SANDBOX_TEAM_ID = 'T_LOCAL';
export const SANDBOX_CHANNEL_ID = 'C_LOCAL';

export function isSandbox() {
  return process.env.NODE_ENV !== 'production';
}

export function assertSandbox() {
  if (!isSandbox()) throw new Error('Local Sandbox is disabled in production builds');
}
