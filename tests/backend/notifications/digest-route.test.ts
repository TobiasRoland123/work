import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({ sendPinnedDigest: vi.fn() }));
vi.mock('@/lib/services/notificationService', () => ({ notificationService: service }));

const { GET } = await import('@/app/api/notifications/pinned-digest/route');
const call = (authorization?: string) =>
  GET(
    new Request('http://127.0.0.1:3000/api/notifications/pinned-digest', {
      headers: authorization ? { authorization } : {},
    })
  );

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'synthetic-cron-secret');
  service.sendPinnedDigest.mockReset().mockResolvedValue(2);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('pinned colleagues digest route', () => {
  it('rejects callers without the cron secret', async () => {
    expect((await call()).status).toBe(401);
    expect((await call('Bearer wrong')).status).toBe(401);
    expect(service.sendPinnedDigest).not.toHaveBeenCalled();
  });

  it('does nothing outside the summary hour', async () => {
    vi.useFakeTimers({ now: new Date('2026-03-04T07:00:00Z'), toFake: ['Date'] });
    const response = await call('Bearer synthetic-cron-secret');
    expect(await response.json()).toEqual({ skipped: true });
    expect(service.sendPinnedDigest).not.toHaveBeenCalled();
  });

  it('sends the summary at 09:00 Copenhagen time', async () => {
    vi.useFakeTimers({ now: new Date('2026-03-04T08:00:00Z'), toFake: ['Date'] });
    const response = await call('Bearer synthetic-cron-secret');
    expect(await response.json()).toEqual({ sent: 2 });
  });
});
