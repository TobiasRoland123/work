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
  params: Record<string, string> = {}
): Promise<T> {
  const token = process.env.SLACK_IMPORT_BOT_TOKEN;
  if (!token) throw new Error('SLACK_IMPORT_BOT_TOKEN is required');
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
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
  return body as T;
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
