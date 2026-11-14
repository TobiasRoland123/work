import { describe, expect, it, vi, afterEach } from 'vitest';
import { compareTs, monthlyWindows } from '@/lib/slack/history/windows';
import { ignoredReason, readSlack } from '@/lib/slack/history/slack';
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
