import { z } from 'zod';

const ts = z.string().regex(/^\d{10,}\.[0-9]{6}$/);
const message = z.object({
  ts,
  user: z.string().optional(),
  text: z.string().optional(),
  bot_id: z.string().optional(),
  subtype: z.string().optional(),
  edited: z.object({ ts }).optional(),
});
const envelope = z.object({
  type: z.literal('event_callback'),
  team_id: z.string(),
  event_id: z.string(),
  event: z.object({
    type: z.literal('message'),
    channel: z.string(),
    ts: ts.optional(),
    event_ts: ts.optional(),
    user: z.string().optional(),
    text: z.string().optional(),
    bot_id: z.string().optional(),
    subtype: z.string().optional(),
    message: message.optional(),
    previous_message: message.optional(),
    deleted_ts: ts.optional(),
  }),
});

export function normalizeSlackEvent(input: unknown, teamId: string, channelId: string) {
  const parsed = envelope.safeParse(input);
  if (!parsed.success) return null;
  const { event, team_id } = parsed.data;
  if (!teamId || !channelId || team_id !== teamId || event.channel !== channelId) return null;
  const deleted = event.subtype === 'message_deleted';
  const edited = event.subtype === 'message_changed';
  if (event.subtype && !deleted && !edited) return null;
  if (deleted) {
    const messageTs = event.deleted_ts;
    const revision = event.event_ts ?? event.ts;
    if (!messageTs || !revision) return null;
    return {
      messageKey: `${teamId}:${channelId}:${messageTs}`,
      teamId,
      channelId,
      messageTs,
      revision,
      slackUserId: event.previous_message?.user ?? null,
      text: null,
      state: 'deleted',
    };
  }
  const item = edited ? event.message : event;
  if (!item || item.bot_id || item.subtype) return null;
  const messageTs = item.ts;
  const revision = edited ? (event.message?.edited?.ts ?? event.event_ts) : item.ts;
  if (!messageTs || !revision || !item.user || !item.text) return null;
  return {
    messageKey: `${teamId}:${channelId}:${messageTs}`,
    teamId,
    channelId,
    messageTs,
    revision,
    slackUserId: item.user ?? null,
    text: item.text,
    state: 'pending',
  };
}
