import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as events } from '@/app/api/slack/events/route';
import { GET as processInbox } from '@/app/api/slack/process/route';
import { POST as createStatus } from '@/app/api/status/route';
import { enqueueSlackEvent, processSlackInbox } from '@/lib/slack/inbox';
import { auth } from '@/auth';
import { statusService } from '@/lib/services/statusService';

vi.mock('@/lib/slack/inbox', () => ({ enqueueSlackEvent: vi.fn(), processSlackInbox: vi.fn() }));
vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/services/statusService', () => ({ statusService: { createNewStatus: vi.fn() } }));

const secret = 'synthetic-signing-secret';
function signed(body: string, timestamp = String(Math.floor(Date.now() / 1000))) {
  const signature = `v0=${createHmac('sha256', secret).update(`v0:${timestamp}:${body}`).digest('hex')}`;
  return new Request('https://work.example/api/slack/events', {
    method: 'POST',
    body,
    headers: { 'x-slack-request-timestamp': timestamp, 'x-slack-signature': signature },
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('SLACK_SIGNING_SECRET', secret);
  vi.stubEnv('SLACK_TEAM_ID', 'TTEST');
  vi.stubEnv('SLACK_CHANNEL_ID', 'CTEST');
  vi.stubEnv('CRON_SECRET', 'synthetic-cron-secret');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Slack HTTP authentication boundaries', () => {
  it('requires configuration and fails closed', async () => {
    vi.stubEnv('SLACK_SIGNING_SECRET', '');
    expect((await events(signed('{}'))).status).toBe(503);
    expect(enqueueSlackEvent).not.toHaveBeenCalled();
  });
  it('rejects unsigned challenge requests before returning the challenge', async () => {
    const response = await events(
      new Request('https://work.example/api/slack/events', {
        method: 'POST',
        body: JSON.stringify({ type: 'url_verification', challenge: 'private' }),
      })
    );
    expect(response.status).toBe(401);
    expect(enqueueSlackEvent).not.toHaveBeenCalled();
  });
  it('answers only a valid signed challenge without queue work', async () => {
    const response = await events(
      signed(JSON.stringify({ type: 'url_verification', challenge: 'verified' }))
    );
    expect(await response.json()).toEqual({ challenge: 'verified' });
    expect(enqueueSlackEvent).not.toHaveBeenCalled();
  });
  it('rejects stale signatures', async () => {
    const request = signed('{}', String(Math.floor(Date.now() / 1000) - 301));
    expect((await events(request)).status).toBe(401);
    expect(enqueueSlackEvent).not.toHaveBeenCalled();
  });
  it('rejects malformed signed JSON', async () => {
    expect((await events(signed('{'))).status).toBe(400);
    expect(enqueueSlackEvent).not.toHaveBeenCalled();
  });
  it('bounds a body even without Content-Length', async () => {
    const request = signed('x'.repeat(256001));
    expect(request.headers.has('content-length')).toBe(false);
    expect((await events(request)).status).toBe(413);
    expect(enqueueSlackEvent).not.toHaveBeenCalled();
  });
  it('does not acknowledge a failed durable enqueue', async () => {
    vi.mocked(enqueueSlackEvent).mockRejectedValue(new Error('database unavailable'));
    expect((await events(signed('{}'))).status).toBe(503);
    expect(processSlackInbox).not.toHaveBeenCalled();
  });
  it('acknowledges only after the queue write resolves, without processing AI inline', async () => {
    let release!: (value: boolean) => void;
    vi.mocked(enqueueSlackEvent).mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      })
    );
    let completed = false;
    const pending = events(signed('{}')).then((response) => {
      completed = true;
      return response;
    });
    await vi.waitFor(() => expect(enqueueSlackEvent).toHaveBeenCalledOnce());
    expect(completed).toBe(false);
    release(true);
    expect((await pending).status).toBe(200);
    expect(processSlackInbox).not.toHaveBeenCalled();
  });
  it.each([undefined, 'Bearer wrong', 'synthetic-cron-secret'])(
    'rejects invalid cron authorization %s',
    async (value) => {
      const request = new Request('https://work.example/api/slack/process', {
        headers: value ? { authorization: value } : {},
      });
      expect((await processInbox(request)).status).toBe(401);
      expect(processSlackInbox).not.toHaveBeenCalled();
    }
  );
  it('never accepts an empty cron secret', async () => {
    vi.stubEnv('CRON_SECRET', '');
    expect(
      (
        await processInbox(
          new Request('https://work.example/api/slack/process', {
            headers: { authorization: 'Bearer ' },
          })
        )
      ).status
    ).toBe(401);
    expect(processSlackInbox).not.toHaveBeenCalled();
  });
  it('processes a valid authenticated cron request', async () => {
    vi.mocked(processSlackInbox).mockResolvedValue({
      applied: 1,
      review: 0,
      ignored: 0,
      retried: 0,
      superseded: 0,
    });
    const response = await processInbox(
      new Request('https://work.example/api/slack/process', {
        headers: { authorization: 'Bearer synthetic-cron-secret' },
      })
    );
    expect(response.status).toBe(200);
    expect(processSlackInbox).toHaveBeenCalledOnce();
  });
});

describe('manual attendance identity boundary', () => {
  it('rejects missing login', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect(
      (
        await createStatus(
          new Request('https://work.example/api/status', { method: 'POST', body: '{}' })
        )
      ).status
    ).toBe(401);
    expect(statusService.createNewStatus).not.toHaveBeenCalled();
  });
  it('uses the session user and strips imported attribution from supplied fields', async () => {
    vi.mocked(auth).mockResolvedValue({ provider: 'slack', userId: 'real-user' } as never);
    vi.mocked(statusService.createNewStatus).mockResolvedValue({ id: 1 } as never);
    const response = await createStatus(
      new Request('https://work.example/api/status', {
        method: 'POST',
        body: JSON.stringify({
          status: 'FROM_HOME',
          userID: 'victim',
          id: 7,
          sourceMessageKey: 'forged',
          startsAt: '2026-01-01',
          createdAt: '2099-01-01',
        }),
      })
    );
    expect(response.status).toBe(201);
    expect(statusService.createNewStatus).toHaveBeenCalledWith({
      status: 'FROM_HOME',
      userID: 'real-user',
    });
  });
  it('rejects unsupported statuses before writing', async () => {
    vi.mocked(auth).mockResolvedValue({ provider: 'slack', userId: 'real-user' } as never);
    expect(
      (
        await createStatus(
          new Request('https://work.example/api/status', {
            method: 'POST',
            body: JSON.stringify({ status: 'MADE_UP' }),
          })
        )
      ).status
    ).toBe(400);
    expect(statusService.createNewStatus).not.toHaveBeenCalled();
  });
});
