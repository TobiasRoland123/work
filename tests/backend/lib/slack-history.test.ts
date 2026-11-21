import { describe, expect, it, vi, afterEach } from 'vitest';
import { compareTs, monthlyWindows } from '@/lib/slack/history/windows';
import { ignoredReason, readSlack, readVerifiedHistory } from '@/lib/slack/history/slack';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe('historical windows', () => {
  it('starts at Copenhagen midnight, preserves DST and final fixed cutoff', () => {
    const windows = monthlyWindows('2026-04-12T10:00:00Z');
    expect(windows[0]).toEqual({
      month: '2026-01',
      oldest: '1767222000.000000',
      latest: '1769900400.000000',
    });
    expect(windows[2].latest).toBe((Date.parse('2026-03-31T22:00:00Z') / 1000).toFixed(6));
    expect(windows[3].latest).toBe((Date.parse('2026-04-12T10:00:00Z') / 1000).toFixed(6));
    windows.slice(1).forEach((w, i) => expect(w.oldest).toBe(windows[i].latest));
  });
  it('compares microseconds without floating point rounding', () =>
    expect(compareTs('99999999999.000001', '99999999999.000002')).toBe(-1));
  it('excludes replies attachments and bots', () => {
    expect(
      ignoredReason({
        ts: '1767222000.000001',
        user: 'U1',
        text: 'WFH',
        thread_ts: '1767222000.000000',
      })
    ).toBe('thread_reply');
    expect(ignoredReason({ ts: '1767222000.000001', user: 'U1', text: 'WFH', files: [{}] })).toBe(
      'attachments'
    );
    expect(ignoredReason({ ts: '1767222000.000001', bot_id: 'B1', text: 'WFH' })).toBe(
      'bot_or_echo'
    );
  });
  it('honors Retry-After without a busy retry loop', async () => {
    vi.stubEnv('SLACK_IMPORT_BOT_TOKEN', 'test');
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response('', { status: 429, headers: { 'Retry-After': '120' } }));
    vi.stubGlobal('fetch', fetch);
    await expect(readSlack('conversations.history')).rejects.toMatchObject({ afterSeconds: 120 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('verified history access', () => {
  function mockSlack(scopes: string, bot = 'B0C0BDJ759Q', readable = true) {
    vi.stubEnv('SLACK_IMPORT_BOT_TOKEN', 'xoxb-test');
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/auth.test'))
        return Response.json(
          { ok: true, team_id: 'T02HKL21R', bot_id: bot },
          { headers: { 'x-oauth-scopes': scopes } }
        );
      if (url.endsWith('/conversations.history'))
        return Response.json(
          readable ? { ok: true, messages: [] } : { ok: false, error: 'not_in_channel' }
        );
      throw new Error('Unexpected Slack method');
    });
    vi.stubGlobal('fetch', fetch);
    return fetch;
  }

  const read = () => readVerifiedHistory('T02HKL21R', 'C94UDEF8X', { limit: '1' });
  it('requires a successful history call for the pinned membership check', async () => {
    const fetch = mockSlack('chat:write,channels:history');
    await expect(read()).resolves.toMatchObject({ history: { messages: [] } });
    expect(fetch).toHaveBeenCalledTimes(2);
    mockSlack('channels:history', undefined, false);
    await expect(read()).rejects.toThrow('not_in_channel');
  });
  it.each(['', 'groups:history,channels:history', 'groups:history'])(
    'rejects unverified public-only history access (%s)',
    async (scopes) => {
      const fetch = mockSlack(scopes);
      await expect(read()).rejects.toThrow('sole installed history scope');
      expect(fetch).toHaveBeenCalledTimes(1);
    }
  );
  it('rejects another bot from the correct workspace', async () => {
    mockSlack('channels:history', 'B_OTHER');
    await expect(read()).rejects.toThrow('WORK 2.0');
  });
  it('requires channel metadata for other channel IDs', async () => {
    const fetch = mockSlack('channels:history');
    await expect(readVerifiedHistory('T02HKL21R', 'C_OTHER', {})).rejects.toThrow(
      'Unexpected Slack method'
    );
    expect(fetch.mock.calls[1][0]).toMatch(/conversations.info$/);
  });
});
