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
    expect(normalizeSlackEvent(event, 'T123', 'C123')).toMatchObject({
      messageKey: 'T123:C123:1788766200.000001',
      revision: '1788766500.000001',
      text: 'Office at 10',
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
