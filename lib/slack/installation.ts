import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const installationCookie = '__Host-slack-install';
export const installationScopes = [
  'users:read',
  'users:read.email',
  'channels:history',
  'chat:write',
];
export const installationPath = '/api/slack/install';
export const installationCallbackPath = '/api/slack/install/callback';

export function installationConfig() {
  const required = (name: string) => {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`Missing ${name}`);
    return value;
  };
  const origin = new URL(required('AUTH_URL'));
  if (origin.protocol !== 'https:' || origin.username || origin.password)
    throw new Error('Installation requires an HTTPS AUTH_URL');
  return {
    origin: origin.origin,
    secret: required('AUTH_SECRET'),
    clientId: required('AUTH_SLACK_ID'),
    clientSecret: required('AUTH_SLACK_SECRET'),
    teamId: required('SLACK_TEAM_ID'),
  };
}

export function signInstallationValue(purpose: string, value: string, secret: string) {
  return createHmac('sha256', secret).update(`${purpose}:${value}`).digest('hex');
}

export function equalInstallationValue(actual: string, expected: string) {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function validInstallationTicket(ticket: string, secret: string) {
  const [expires, signature, extra] = ticket.split('.');
  const remaining = Number(expires) - Date.now();
  return (
    !extra &&
    /^\d+$/.test(expires ?? '') &&
    remaining > 0 &&
    remaining <= 15 * 60_000 &&
    equalInstallationValue(signature ?? '', signInstallationValue('ticket', expires, secret))
  );
}

export function createInstallationState(secret: string) {
  const state = randomBytes(32).toString('hex');
  const value = `${Date.now() + 10 * 60_000}.${state}`;
  return { state, cookie: `${value}.${signInstallationValue('state', value, secret)}` };
}

export function validInstallationState(state: string, cookie: string, secret: string) {
  const [expires, nonce, signature, extra] = cookie.split('.');
  const remaining = Number(expires) - Date.now();
  return (
    !extra &&
    /^[a-f0-9]{64}$/.test(state) &&
    remaining > 0 &&
    remaining <= 10 * 60_000 &&
    equalInstallationValue(state, nonce ?? '') &&
    equalInstallationValue(
      signature ?? '',
      signInstallationValue('state', `${expires}.${nonce}`, secret)
    )
  );
}

export async function exchangeInstallationCode(
  code: string,
  config: ReturnType<typeof installationConfig>
) {
  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: `${config.origin}${installationCallbackPath}`,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  const result = await response.json();
  if (
    !response.ok ||
    result.ok !== true ||
    result.team?.id !== config.teamId ||
    result.token_type !== 'bot' ||
    typeof result.access_token !== 'string' ||
    !result.access_token.startsWith('xoxb-') ||
    result.is_enterprise_install === true ||
    typeof result.scope !== 'string' ||
    !installationScopes.every((scope) => result.scope.split(',').includes(scope))
  )
    throw new Error('Slack installation could not be verified');
  // Slack retains the bot token in OAuth & Permissions. An operator copies it
  // directly into Vercel; never return it to the browser or write it to logs.
}
