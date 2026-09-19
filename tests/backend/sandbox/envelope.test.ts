import { describe, expect, it } from 'vitest';
import { inspectSlackEvent } from '@/lib/slack/events';
import { SANDBOX_CHANNEL_ID, SANDBOX_TEAM_ID } from '@/lib/sandbox/enabled';
import {
  deletedEnvelope,
  editedEnvelope,
  messageEnvelope,
  sandboxMessageKey,
  sandboxTs,
} from '@/lib/sandbox/envelope';

const inspect = (envelope: unknown) =>
  inspectSlackEvent(envelope, SANDBOX_TEAM_ID, SANDBOX_CHANNEL_ID);

describe('sandboxTs', () => {
  it('produces Slack wire format for the announcement instant', () => {
    const ts = sandboxTs(new Date('2026-09-19T07:30:00Z'), 0);
    expect(ts).toMatch(/^\d{10}\.\d{6}$/);
    expect(ts.startsWith(String(Math.floor(Date.parse('2026-09-19T07:30:00Z') / 1000)))).toBe(true);
  });
  it('stays distinct for messages announced in the same millisecond', () => {
    const instant = new Date('2026-09-19T07:30:00Z');
    const seen = new Set(Array.from({ length: 50 }, () => sandboxTs(instant, 123456)));
    expect(seen.size).toBe(50);
  });
  it('rejects instants Slack could not have produced', () => {
    expect(() => sandboxTs(new Date(NaN))).toThrow('Invalid instant');
    expect(() => sandboxTs(new Date(0))).toThrow('Invalid instant');
  });
});

describe('sandbox envelopes', () => {
  const messageTs = '1789000000.000123';
  it('build a message the intake accepts as pending', () => {
    const result = inspect(messageEnvelope({ slackUserId: 'U_LOCAL_A', text: 'wfh', messageTs }));
    expect(result.event).toMatchObject({
      messageKey: sandboxMessageKey(messageTs),
      teamId: SANDBOX_TEAM_ID,
      channelId: SANDBOX_CHANNEL_ID,
      messageTs,
      revision: messageTs,
      slackUserId: 'U_LOCAL_A',
      text: 'wfh',
      state: 'pending',
    });
  });
  it('build an edit whose revision is the edit instant', () => {
    const revision = '1789000060.000001';
    const result = inspect(
      editedEnvelope({ slackUserId: 'U_LOCAL_A', text: 'wfh tomorrow', messageTs, revision })
    );
    expect(result.event).toMatchObject({
      messageKey: sandboxMessageKey(messageTs),
      messageTs,
      revision,
      text: 'wfh tomorrow',
      state: 'pending',
    });
  });
  it('build a deletion that keeps the author for identity lookup', () => {
    const revision = '1789000120.000001';
    const result = inspect(deletedEnvelope({ slackUserId: 'U_LOCAL_A', messageTs, revision }));
    expect(result.event).toMatchObject({
      messageKey: sandboxMessageKey(messageTs),
      revision,
      slackUserId: 'U_LOCAL_A',
      text: null,
      state: 'deleted',
    });
  });
  it('are rejected by an intake configured for the real workspace', () => {
    const envelope = messageEnvelope({ slackUserId: 'U_LOCAL_A', text: 'wfh', messageTs });
    expect(inspectSlackEvent(envelope, 'T02HKL21R', 'C94UDEF8X')).toEqual({
      reason: 'wrong_workspace',
    });
  });
});
