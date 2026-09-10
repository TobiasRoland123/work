export type SlackProfile = {
  email?: string;
  email_verified?: boolean;
  real_name?: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  phone?: string;
  image_512?: string;
};
export type SlackUser = {
  id: string;
  team_id?: string;
  deleted?: boolean;
  is_bot?: boolean;
  is_restricted?: boolean;
  is_ultra_restricted?: boolean;
  is_invited_user?: boolean;
  real_name?: string;
  profile?: SlackProfile;
};

export class SlackApiError extends Error {
  constructor(
    message: string,
    readonly errorCode?: string,
    readonly status?: number
  ) {
    super(message);
    this.name = 'SlackApiError';
  }
}
export class SlackRateLimitError extends SlackApiError {
  constructor(
    readonly retryAfter: number,
    status = 429
  ) {
    super(`Slack API rate limit exceeded; retry after ${retryAfter}s`, 'ratelimited', status);
    this.name = 'SlackRateLimitError';
  }
}
function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required Slack configuration: ${name}`);
  return value;
}
export function getSlackTeamId(): string {
  return requiredEnv('SLACK_TEAM_ID');
}
function getBotToken(): string {
  return requiredEnv('SLACK_BOT_TOKEN');
}

async function slackRequest<T>(method: string, params: Record<string, string> = {}): Promise<T> {
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getBotToken()}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('retry-after') ?? '60');
    throw new SlackRateLimitError(Number.isFinite(retryAfter) ? retryAfter : 60);
  }
  const body = (await response.json()) as T & { ok?: boolean; error?: string };
  if (!response.ok || body.ok !== true)
    throw new SlackApiError(
      `Slack ${method} failed: ${body.error ?? response.statusText}`,
      body.error,
      response.status
    );
  return body;
}
export async function validateSlackBotTeam(): Promise<{ teamId: string; userId: string }> {
  const expected = getSlackTeamId();
  const result = await slackRequest<{ ok: true; team_id: string; user_id: string }>('auth.test');
  if (result.team_id !== expected)
    throw new SlackApiError('Slack bot token belongs to a different workspace', 'wrong_team');
  return { teamId: result.team_id, userId: result.user_id };
}
export async function listSlackUsers(): Promise<SlackUser[]> {
  const users: SlackUser[] = [];
  let cursor = '';
  const seen = new Set<string>();
  do {
    if (seen.has(cursor))
      throw new SlackApiError(
        'Slack users.list returned a repeated pagination cursor',
        'pagination_loop'
      );
    seen.add(cursor);
    const result = await slackRequest<{
      members: SlackUser[];
      response_metadata?: { next_cursor?: string };
    }>('users.list', { limit: '200', ...(cursor ? { cursor } : {}) });
    if (!Array.isArray(result.members)) throw new SlackApiError('Invalid Slack directory response');
    users.push(...result.members);
    cursor = result.response_metadata?.next_cursor?.trim() ?? '';
  } while (cursor);
  return users;
}

export function isActiveSlackMember(user: SlackUser) {
  return (
    user.team_id === getSlackTeamId() &&
    !user.deleted &&
    !user.is_bot &&
    !user.is_restricted &&
    !user.is_ultra_restricted &&
    !user.is_invited_user &&
    user.id !== 'USLACKBOT'
  );
}
export async function getSlackUser(userId: string) {
  const result = await slackRequest<{ user: SlackUser }>('users.info', { user: userId });
  if (!result.user || result.user.id !== userId)
    throw new SlackApiError('Invalid Slack user response');
  return result.user;
}
export async function getSlackPermalink(channel: string, ts: string) {
  const result = await slackRequest<{ permalink: string }>('chat.getPermalink', {
    channel,
    message_ts: ts,
  });
  const url = new URL(result.permalink);
  if (
    url.protocol !== 'https:' ||
    !url.hostname.endsWith('.slack.com') ||
    url.username ||
    url.password ||
    url.port
  )
    throw new SlackApiError('Invalid Slack permalink');
  return url.toString();
}

export async function notifySlackStatusNotSet(channel: string, userId: string, messageTs: string) {
  const permalink = await getSlackPermalink(channel, messageTs);
  await slackRequest('chat.postMessage', {
    channel,
    text: `<@${userId}>, your <${permalink}|message> didn't set a status because I couldn't determine a clear attendance status. Please send a new message with your status and when it applies.`,
    unfurl_links: 'false',
    unfurl_media: 'false',
  });
}
