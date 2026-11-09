import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifySlackSignature } from '@/lib/slack/signature';
import { inspectSlackEvent, normalizeSlackEvent } from '@/lib/slack/events';
const original = {
  type: 'event_callback',
  team_id: 'T123',
  event_id: 'Ev123',
  event: {
    type: 'message',
    channel: 'C123',
    ts: '1788766200.000001',
    user: 'U123',
    text: 'WFH today',
  },
};

describe('Slack event security and normalization', () => {
  it('verifies exact signed body and rejects tampering, stale requests and missing configuration', () => {
    const body = JSON.stringify(original),
      timestamp = '1788766200',
      secret = 'test-secret';
    const signature = `v0=${createHmac('sha256', secret).update(`v0:${timestamp}:${body}`).digest('hex')}`;
    const now = Number(timestamp) * 1000;
    expect(verifySlackSignature(body, timestamp, signature, secret, now)).toBe(true);
    expect(verifySlackSignature(body + ' ', timestamp, signature, secret, now)).toBe(false);
    expect(verifySlackSignature(body, timestamp, signature, secret, now + 301000)).toBe(false);
    expect(verifySlackSignature(body, timestamp, signature, undefined, now)).toBe(false);
    expect(verifySlackSignature(body, timestamp, 'bad', secret, now)).toBe(false);
  });
  it('ignores other workspaces, channels and bots', () => {
    expect(normalizeSlackEvent(original, 'T-other', 'C123')).toBeNull();
    expect(normalizeSlackEvent(original, 'T123', 'C-other')).toBeNull();
    expect(
      normalizeSlackEvent(
        { ...original, event: { ...original.event, bot_id: 'B123' } },
        'T123',
        'C123'
      )
    ).toBeNull();
  });
  it('keys edits to their original message and orders by edit timestamp', () => {
    const event = {
      ...original,
      event: {
        type: 'message',
        subtype: 'message_changed',
        channel: 'C123',
        event_ts: '1788766500.000001',
        message: { ...original.event, text: 'Office at 10', edited: { ts: '1788766500.000001' } },
      },
    };
    expect(normalizeSlackEvent(event, 'T123', 'C123')).toEqual({
      messageKey: 'T123:C123:1788766200.000001',
      teamId: 'T123',
      channelId: 'C123',
      messageTs: '1788766200.000001',
      revision: '1788766500.000001',
      slackUserId: 'U123',
      text: 'Office at 10',
      state: 'pending',
    });
  });
  it('normalizes deletions without retaining their old text', () => {
    const event = {
      ...original,
      event: {
        type: 'message',
        subtype: 'message_deleted',
        channel: 'C123',
        deleted_ts: original.event.ts,
        event_ts: '1788766500.000001',
        previous_message: original.event,
      },
    };
    expect(normalizeSlackEvent(event, 'T123', 'C123')).toMatchObject({
      state: 'deleted',
      text: null,
    });
  });
});

describe('Slack thread replies', () => {
  const reply = {
    ...original,
    event: {
      ...original.event,
      ts: '1788766300.000001',
      thread_ts: original.event.ts,
      parent_user_id: 'U999',
      text: 'Enjoy your day off!',
    },
  };
  it.each([
    ['someone else', 'U999'],
    ['yourself', 'U123'],
    ['an unknown author', undefined],
  ])('ignores replies to %s, including their edits', (_, parentUserId) => {
    const event = { ...reply.event, parent_user_id: parentUserId };
    expect(inspectSlackEvent({ ...reply, event }, 'T123', 'C123')).toEqual({
      reason: 'thread_reply',
    });
    const edited = {
      ...original,
      event: {
        type: 'message',
        subtype: 'message_changed',
        channel: 'C123',
        event_ts: '1788766500.000001',
        message: { ...event, edited: { ts: '1788766500.000001' } },
      },
    };
    expect(inspectSlackEvent(edited, 'T123', 'C123')).toEqual({ reason: 'thread_reply' });
  });
  it('keeps thread parents', () => {
    const parent = { ...original, event: { ...original.event, thread_ts: original.event.ts } };
    expect(normalizeSlackEvent(parent, 'T123', 'C123')).toMatchObject({ text: 'WFH today' });
  });
});

describe('Slack intake diagnostics', () => {
  it.each([
    ['wrong_workspace', { ...original, team_id: 'OTHER' }],
    ['wrong_channel', { ...original, event: { ...original.event, channel: 'OTHER' } }],
    ['bot_message', { ...original, event: { ...original.event, bot_id: 'B123' } }],
    ['unsupported_subtype', { ...original, event: { ...original.event, subtype: 'channel_join' } }],
    ['incomplete_message', { ...original, event: { ...original.event, text: undefined } }],
    ['invalid_event', null],
  ])('reports %s without returning the rejected payload', (reason, payload) => {
    expect(inspectSlackEvent(payload, 'T123', 'C123')).toEqual({ reason });
  });
});

describe('Slack signature replay window', () => {
  const body = JSON.stringify(original);
  const timestamp = '1788766200';
  const secret = 'test-secret';
  const signature = `v0=${createHmac('sha256', secret).update(`v0:${timestamp}:${body}`).digest('hex')}`;
  it.each([
    [-300001, false],
    [-300000, true],
    [300000, true],
    [300001, false],
  ] as const)('bounds clock skew at %i milliseconds', (skew, valid) => {
    expect(
      verifySlackSignature(body, timestamp, signature, secret, Number(timestamp) * 1000 + skew)
    ).toBe(valid);
  });
  it.each([
    [null, signature],
    ['1788766200.5', signature],
    ['invalid', signature],
    [timestamp, null],
    [timestamp, `v1=${'a'.repeat(64)}`],
    [timestamp, `v0=${'a'.repeat(63)}`],
  ])('rejects malformed signing headers %# without throwing', (time, sig) => {
    expect(verifySlackSignature(body, time, sig, secret, Number(timestamp) * 1000)).toBe(false);
  });
});

describe('Slack edit and deletion revision fallbacks', () => {
  it('uses event_ts for an edit without edited.ts while preserving original message identity', () => {
    const event = {
      ...original,
      event: {
        type: 'message',
        subtype: 'message_changed',
        channel: 'C123',
        event_ts: '1788766500.000001',
        message: { ...original.event, text: 'Changed' },
      },
    };
    expect(normalizeSlackEvent(event, 'T123', 'C123')).toEqual({
      messageKey: 'T123:C123:1788766200.000001',
      teamId: 'T123',
      channelId: 'C123',
      messageTs: '1788766200.000001',
      revision: '1788766500.000001',
      slackUserId: 'U123',
      text: 'Changed',
      state: 'pending',
    });
  });
  it.each([
    { subtype: 'message_changed', event_ts: '1788766500.000001' },
    { subtype: 'message_changed', message: original.event },
    { subtype: 'message_deleted', deleted_ts: original.event.ts },
    { subtype: 'message_deleted', event_ts: '1788766500.000001' },
  ])('does not invent missing edit/deletion identifiers %#', (details) => {
    expect(
      inspectSlackEvent(
        {
          ...original,
          event: {
            type: 'message',
            channel: 'C123',
            ...details,
          },
        },
        'T123',
        'C123'
      )
    ).toEqual({ reason: 'incomplete_message' });
  });
  it.each([
    ['', 'C123'],
    ['T123', ''],
  ])('fails closed without workspace/channel configuration %#', (team, channel) => {
    expect(inspectSlackEvent(original, team, channel)).toEqual({ reason: 'missing_configuration' });
  });
});
