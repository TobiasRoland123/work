export type HistoryMessage = {
  ts: string;
  user?: string;
  text?: string;
  edited?: { ts: string };
  bot_id?: string;
  subtype?: string;
  thread_ts?: string;
  attachments?: unknown[];
  files?: unknown[];
};
export class HistoryRetry extends Error {
  constructor(
    public afterSeconds: number,
    message: string
  ) {
    super(message);
  }
}
/** Only these three read operations are available to the historical importer. */
export async function readSlack<T>(
  method: 'auth.test' | 'conversations.info' | 'conversations.history',
  params: Record<string, string> = {},
  installedScopes?: Set<string>
): Promise<T> {
  const token = process.env.SLACK_IMPORT_BOT_TOKEN;
  if (!token) throw new Error('SLACK_IMPORT_BOT_TOKEN is required');
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    redirect: 'error',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 429)
    throw new HistoryRetry(
      Math.max(1, Number(response.headers.get('retry-after')) || 60),
      'Slack throttled; retry after recorded deadline'
    );
  if (response.status >= 500) throw new HistoryRetry(60, 'Slack temporarily unavailable');
  const body = await response.json();
  if (!response.ok || body.ok !== true)
    throw new Error(`Slack read failed: ${body.error ?? response.status}`);
  for (const scope of (response.headers.get('x-oauth-scopes') ?? '').split(','))
    if (scope.trim()) installedScopes?.add(scope.trim());
  return body as T;
}
export async function readVerifiedHistory(
  teamId: string,
  channelId: string,
  page: Record<string, string>
) {
  const scopes = new Set<string>();
  const auth = await readSlack<{ team_id: string; bot_id?: string }>('auth.test', {}, scopes);
  if (auth.team_id !== teamId) throw new Error('Slack workspace mismatch');
  let channelName: string | undefined;
  if (teamId === 'T02HKL21R' && channelId === 'C94UDEF8X') {
    if (!process.env.SLACK_IMPORT_BOT_TOKEN?.startsWith('xoxb-') || auth.bot_id !== 'B0C0BDJ759Q')
      throw new Error('Expected the verified WORK 2.0 bot');
    // A bot with only public-channel history access must be a member to read this channel.
    const historyScopes = [...scopes].filter((scope) => scope.endsWith(':history'));
    if (historyScopes.length !== 1 || historyScopes[0] !== 'channels:history')
      throw new Error('Expected channels:history as the sole installed history scope');
  } else {
    const info = await readSlack<{
      channel?: { id: string; is_member: boolean; is_private: boolean; name: string };
    }>('conversations.info', { channel: channelId }, scopes);
    if (
      info.channel?.id !== channelId ||
      !info.channel.is_member ||
      info.channel.is_private !== false
    )
      throw new Error('Expected a public channel with the bot as a member');
    channelName = info.channel.name;
  }
  const history = await readSlack<{
    messages: HistoryMessage[];
    has_more?: boolean;
    is_limited?: boolean;
    response_metadata?: { next_cursor?: string };
  }>('conversations.history', { ...page, channel: channelId }, scopes);
  if (!Array.isArray(history.messages)) throw new Error('Malformed history response');
  if (scopes.size && !scopes.has('channels:history'))
    throw new Error('Installed token lacks channels:history');
  return { history, channelName, installedScopes: [...scopes] };
}

export function ignoredReason(message: HistoryMessage): string | null {
  if (message.bot_id) return 'bot_or_echo';
  if (message.subtype) return 'unsupported_subtype';
  if (message.thread_ts && message.thread_ts !== message.ts) return 'thread_reply';
  if (message.attachments?.length || message.files?.length) return 'attachments';
  if (!message.user || !message.text) return 'missing_author_or_text';
  if (message.text.length > 12000) return 'oversized_text';
  return null;
}
