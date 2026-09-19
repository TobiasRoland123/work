import { SANDBOX_CHANNEL_ID, SANDBOX_TEAM_ID } from './enabled';

// Slack ts values are `<seconds>.<microseconds>`. The message key is team:channel:ts, so
// two messages announced in the same second need distinct microsecond parts or the
// second silently becomes an edit of the first.
let sequence = 0;

/** A Slack-shaped timestamp for `instant`, unique within this process. */
export function sandboxTs(instant: Date = new Date(), now: number = Date.now()) {
  const seconds = Math.floor(instant.getTime() / 1000);
  if (!Number.isFinite(seconds) || seconds < 1_000_000_000) throw new Error('Invalid instant');
  sequence = (sequence + 1) % 1000;
  const micros = (now % 1000) * 1000 + sequence;
  return `${seconds}.${String(micros).padStart(6, '0')}`;
}

export function sandboxMessageKey(messageTs: string) {
  return `${SANDBOX_TEAM_ID}:${SANDBOX_CHANNEL_ID}:${messageTs}`;
}

function eventId(ts: string) {
  return `EvLOCAL${ts.replace('.', '')}`;
}

/** A genuine `message` event envelope, as Slack would deliver it. */
export function messageEnvelope(input: { slackUserId: string; text: string; messageTs: string }) {
  return {
    type: 'event_callback' as const,
    team_id: SANDBOX_TEAM_ID,
    event_id: eventId(input.messageTs),
    event: {
      type: 'message' as const,
      channel: SANDBOX_CHANNEL_ID,
      user: input.slackUserId,
      text: input.text,
      ts: input.messageTs,
      event_ts: input.messageTs,
    },
  };
}

/** A `message_changed` envelope. `revision` is the edit instant and must be newer than the last one. */
export function editedEnvelope(input: {
  slackUserId: string;
  text: string;
  messageTs: string;
  revision: string;
}) {
  return {
    type: 'event_callback' as const,
    team_id: SANDBOX_TEAM_ID,
    event_id: eventId(input.revision),
    event: {
      type: 'message' as const,
      subtype: 'message_changed' as const,
      channel: SANDBOX_CHANNEL_ID,
      event_ts: input.revision,
      message: {
        user: input.slackUserId,
        text: input.text,
        ts: input.messageTs,
        edited: { ts: input.revision },
      },
      previous_message: { user: input.slackUserId, ts: input.messageTs },
    },
  };
}

/** A `message_deleted` envelope. */
export function deletedEnvelope(input: {
  slackUserId: string;
  messageTs: string;
  revision: string;
}) {
  return {
    type: 'event_callback' as const,
    team_id: SANDBOX_TEAM_ID,
    event_id: eventId(input.revision),
    event: {
      type: 'message' as const,
      subtype: 'message_deleted' as const,
      channel: SANDBOX_CHANNEL_ID,
      deleted_ts: input.messageTs,
      event_ts: input.revision,
      previous_message: { user: input.slackUserId, ts: input.messageTs },
    },
  };
}
