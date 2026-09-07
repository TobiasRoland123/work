import { describe, expect, it } from 'vitest';
import { normalizeSlackEvent } from '@/lib/slack/events';

describe('documented Slack deletion payload', () => {
  it('normalizes a deletion without optional previous_message or sender data', () => {
    // Slack's official message_deleted Events API example has no previous_message.
    const event = {
      type: 'event_callback',
      team_id: 'TTEST',
      event_id: 'Ev-delete',
      event: {
        type: 'message',
        subtype: 'message_deleted',
        hidden: true,
        channel: 'CTEST',
        ts: '1788766500.000001',
        deleted_ts: '1788766200.000001',
      },
    };
    expect(normalizeSlackEvent(event, 'TTEST', 'CTEST')).toMatchObject({
      messageKey: 'TTEST:CTEST:1788766200.000001',
      revision: '1788766500.000001',
      state: 'deleted',
      text: null,
    });
  });
});
