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

export function inspectSlackEvent(input: unknown, teamId: string, channelId: string) {
  const parsed = envelope.safeParse(input);
  if (!parsed.success) return { reason: 'invalid_event' as const };
  const { event, team_id } = parsed.data;
  if (!teamId || !channelId) return { reason: 'missing_configuration' as const };
  if (team_id !== teamId) return { reason: 'wrong_workspace' as const };
  if (event.channel !== channelId) return { reason: 'wrong_channel' as const };
  const deleted = event.subtype === 'message_deleted';
  const edited = event.subtype === 'message_changed';
  if (event.subtype && !deleted && !edited) return { reason: 'unsupported_subtype' as const };
  if (deleted) {
    const messageTs = event.deleted_ts;
    const revision = event.event_ts ?? event.ts;
    if (!messageTs || !revision) return { reason: 'incomplete_message' as const };
    return {
      event: {
        messageKey: `${teamId}:${channelId}:${messageTs}`,
        teamId,
        channelId,
        messageTs,
        revision,
        slackUserId: event.previous_message?.user ?? null,
        text: null,
        state: 'deleted',
      },
    };
  }
  const item = edited ? event.message : event;
  if (!item) return { reason: 'incomplete_message' as const };
  if (item.bot_id) return { reason: 'bot_message' as const };
  if (item.subtype) return { reason: 'unsupported_subtype' as const };
  const messageTs = item.ts;
  const revision = edited ? (event.message?.edited?.ts ?? event.event_ts) : item.ts;
  if (!messageTs || !revision || !item.user || !item.text)
    return { reason: 'incomplete_message' as const };
  return {
    event: {
      messageKey: `${teamId}:${channelId}:${messageTs}`,
      teamId,
      channelId,
      messageTs,
      revision,
      slackUserId: item.user ?? null,
      text: item.text,
      state: 'pending',
    },
  };
}

export function normalizeSlackEvent(input: unknown, teamId: string, channelId: string) {
  return inspectSlackEvent(input, teamId, channelId).event ?? null;
}
