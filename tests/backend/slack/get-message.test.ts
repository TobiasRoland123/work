import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSlackMessage } from '@/lib/slack/client';

const ts = '1790000000.123456';
const reply = (body: object) => new Response(JSON.stringify({ ok: true, ...body }));
const params = (call: unknown[]) =>
  Object.fromEntries(new URLSearchParams(String((call[1] as RequestInit).body)));

describe('getSlackMessage', () => {
  beforeEach(() => vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-test'));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('reads one channel message by its exact ts', async () => {
    const fetch = vi.fn().mockResolvedValue(reply({ messages: [{ ts, text: 'wfh' }] }));
    vi.stubGlobal('fetch', fetch);
    await expect(getSlackMessage('C1', ts)).resolves.toEqual({ ts, text: 'wfh' });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('https://slack.com/api/conversations.history');
    expect(params(fetch.mock.calls[0])).toEqual({
      channel: 'C1',
      oldest: ts,
      latest: ts,
      inclusive: 'true',
      limit: '1',
    });
  });

  it('falls back to the thread for replies and returns null when Slack has neither', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reply({ messages: [] }))
      .mockResolvedValueOnce(
        reply({
          messages: [
            { ts: '1789999999.000001', text: 'parent' },
            { ts, text: 'syg' },
          ],
        })
      )
      .mockResolvedValueOnce(reply({ messages: [] }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: false, error: 'thread_not_found' }))
      );
    vi.stubGlobal('fetch', fetch);
    await expect(getSlackMessage('C1', ts)).resolves.toEqual({ ts, text: 'syg' });
    expect(fetch.mock.calls[1][0]).toBe('https://slack.com/api/conversations.replies');
    expect(params(fetch.mock.calls[1])).toMatchObject({ channel: 'C1', ts });
    expect(params(fetch.mock.calls[1]).limit).toBeUndefined();
    await expect(getSlackMessage('C1', ts)).resolves.toBeNull();
  });
});
