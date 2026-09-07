import { z } from 'zod';

export const SLACK_TEAM_ID = 'T02HKL21R';
export const SLACK_APP_ID = 'A0BVDBKEYBV';

export class SlackError extends Error {
  constructor(public readonly code: string, public readonly retryAfter?: number) {
    super(`Slack request failed: ${code}`);
  }
}

const profileSchema = z.object({
  email: z.string().optional(), first_name: z.string().optional(), last_name: z.string().optional(),
  real_name: z.string().optional(), display_name: z.string().optional(),
  image_512: z.string().optional(), image_192: z.string().optional(),
});
export const slackUserSchema = z.object({
  id: z.string().regex(/^[UW][A-Z0-9]+$/), team_id: z.string(),
  deleted: z.boolean().optional(), is_bot: z.boolean().optional(), is_app_user: z.boolean().optional(),
  is_restricted: z.boolean().optional(), is_ultra_restricted: z.boolean().optional(),
  is_invited_user: z.boolean().optional(), profile: profileSchema,
});
export type SlackUser = z.infer<typeof slackUserSchema>;
export const messageSchema = z.object({
  ts: z.string().regex(/^\d{10,}\.\d{6}$/), user: z.string().optional(), text: z.string().optional(),
  subtype: z.string().optional(), bot_id: z.string().optional(), thread_ts: z.string().optional(),
  edited: z.object({ ts: z.string() }).optional(),
});
export type SlackMessage = z.infer<typeof messageSchema>;

export function isWorkspaceMember(user: SlackUser) {
  return user.team_id === SLACK_TEAM_ID && !user.deleted && !user.is_bot && !user.is_app_user &&
    !user.is_restricted && !user.is_ultra_restricted && !user.is_invited_user;
}

// Only read methods are exposed. Tokens never appear in URLs, logs, or browser responses.
export class SlackClient {
  constructor(private readonly token = process.env.SLACK_BOT_TOKEN, private readonly request = fetch) {}

  private async call(method: 'auth.test' | 'users.list' | 'users.info' | 'conversations.history' | 'conversations.info', params: Record<string, string> = {}) {
    if (!this.token?.startsWith('xoxb-')) throw new SlackError('missing_bot_token');
    let response: Response;
    try {
      response = await this.request(`https://slack.com/api/${method}`, {
        method: 'POST', headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params), cache: 'no-store', signal: AbortSignal.timeout(15_000), redirect: 'error',
      });
    } catch { throw new SlackError('network_error'); }
    if (response.status === 429) {
      const retry = Number(response.headers.get('retry-after'));
      throw new SlackError('rate_limited', Number.isFinite(retry) && retry > 0 ? Math.ceil(retry) : 60);
    }
    if (!response.ok) throw new SlackError(`http_${response.status}`);
    const payload: unknown = await response.json().catch(() => { throw new SlackError('invalid_response'); });
    const envelope = z.object({ ok: z.boolean(), error: z.string().optional() }).passthrough().safeParse(payload);
    if (!envelope.success) throw new SlackError('invalid_response');
    if (!envelope.data.ok) throw new SlackError('api_error');
    return envelope.data;
  }

  async verifyWorkspace() {
    const result = await this.call('auth.test');
    if (result.team_id !== SLACK_TEAM_ID || typeof result.bot_id !== 'string') throw new SlackError('wrong_workspace_or_token');
  }

  async getUser(id: string): Promise<SlackUser> {
    const result = await this.call('users.info', { user: id });
    const user = slackUserSchema.safeParse(result.user);
    if (!user.success || user.data.id !== id) throw new SlackError('invalid_user');
    return user.data;
  }

  async listUsers(): Promise<SlackUser[]> {
    const members: SlackUser[] = [];
    const seen = new Set<string>();
    let cursor = '';
    do {
      const result = await this.call('users.list', { limit: '200', cursor });
      const page = z.object({ members: z.array(slackUserSchema), response_metadata: z.object({ next_cursor: z.string().optional() }).optional() }).safeParse(result);
      if (!page.success) throw new SlackError('invalid_users_page');
      members.push(...page.data.members);
      cursor = page.data.response_metadata?.next_cursor?.trim() ?? '';
      if (cursor && (seen.has(cursor) || seen.size >= 100)) throw new SlackError('incomplete_pagination');
      seen.add(cursor);
    } while (cursor);
    return members;
  }

  async verifyChannel(channel: string) {
    if (!/^[CG][A-Z0-9]+$/.test(channel)) throw new SlackError('invalid_channel_id');
    const result = await this.call('conversations.info', { channel });
    const data = z.object({ id: z.string(), name: z.string(), is_member: z.boolean(), is_archived: z.boolean().optional(), is_shared: z.boolean().optional(), is_ext_shared: z.boolean().optional() }).safeParse(result.channel);
    if (!data.success || data.data.id !== channel || !data.data.is_member || data.data.is_archived || data.data.is_shared || data.data.is_ext_shared || data.data.name !== 'wørk') {
      throw new SlackError('wrong_channel_or_membership');
    }
  }

  // Return only a complete snapshot; callers must never reconcile deletions from a partial page.
  async history(channel: string, oldest: string, latest: string): Promise<SlackMessage[]> {
    const messages: SlackMessage[] = [];
    const seen = new Set<string>();
    let cursor = '';
    do {
      const result = await this.call('conversations.history', { channel, oldest, latest, inclusive: 'true', limit: '200', cursor });
      const page = z.object({ messages: z.array(messageSchema), has_more: z.boolean().optional(), is_limited: z.boolean().optional(), response_metadata: z.object({ next_cursor: z.string().optional() }).optional() }).safeParse(result);
      if (!page.success || page.data.is_limited) throw new SlackError('incomplete_history');
      messages.push(...page.data.messages);
      cursor = page.data.response_metadata?.next_cursor?.trim() ?? '';
      if ((!cursor && page.data.has_more) || (cursor && (seen.has(cursor) || seen.size >= 100))) throw new SlackError('incomplete_pagination');
      seen.add(cursor);
    } while (cursor);
    return messages;
  }
}
