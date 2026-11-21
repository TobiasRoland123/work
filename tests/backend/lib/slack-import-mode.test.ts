import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  correct: vi.fn(),
  remove: vi.fn(),
  dbRead: vi.fn(() => {
    throw new Error('Unexpected database access');
  }),
}));
vi.mock('@/db', () => ({ db: { select: mocks.dbRead } }));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: vi.fn(),
}));
vi.mock('@/auth', () => ({ auth: async () => ({ provider: 'slack', userId: 'admin' }) }));
vi.mock('@/lib/auth/require-user', () => ({ requireUserId: async () => 'admin' }));
vi.mock('@/lib/auth/roles', () => ({
  isAdmin: async () => true,
  getUserRole: async () => 'member',
}));
vi.mock('@/lib/services/statusService', () => ({
  statusService: {
    createNewStatus: mocks.create,
    createColleagueStatuses: mocks.create,
    correctImportedStatus: mocks.correct,
    deleteStatusById: mocks.remove,
    deleteStatusByUserUserId: mocks.remove,
  },
}));

import { slackEchoWritesEnabled } from '@/lib/slack/import-mode';
import { postSlackMessage, updateSlackMessage } from '@/lib/slack/client';
import { runEchoJob, scheduleEcho, syncUserEchoes } from '@/lib/services/echoService';
import * as actions from '@/app/actions/statusActions';
import { POST } from '@/app/api/status/route';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('historical import Echo and manual write interlock', () => {
  it.each(['rehearsal', 'production', 'misspelled'])(
    'blocks all write paths in %s mode',
    async (mode) => {
      vi.stubEnv('SLACK_HISTORY_IMPORT_MODE', mode);
      const fetch = vi.fn();
      vi.stubGlobal('fetch', fetch);
      expect(slackEchoWritesEnabled()).toBe(false);
      const response = await POST(
        new Request('http://localhost/api/status', { method: 'POST', body: '{}' })
      );
      expect(response.status).toBe(503);
      await expect(
        postSlackMessage({ channel: 'C1', text: 'test', username: 'test' })
      ).rejects.toThrow('temporarily unavailable');
      await expect(updateSlackMessage({ channel: 'C1', ts: '1.0', text: 'test' })).rejects.toThrow(
        'temporarily unavailable'
      );
      const transport = { post: vi.fn(), update: vi.fn() };
      expect(await runEchoJob({ force: true, transport })).toEqual({
        posted: 0,
        retrying: 0,
        updated: 0,
        failed: 0,
        withdrawn: 0,
      });
      await syncUserEchoes('admin', { transport });
      expect(await scheduleEcho(null as never, null as never, new Date())).toBeNull();
      expect((await actions.planStatusAction({})).ok).toBe(false);
      expect((await actions.planColleagueStatusAction('member', {})).ok).toBe(false);
      expect((await actions.correctImportedStatusAction({})).ok).toBe(false);
      await expect(actions.createNewStatusAction({} as never)).rejects.toThrow(
        'temporarily unavailable'
      );
      await expect(actions.updateStatusByUserUserIdAction('admin', {})).rejects.toThrow(
        'temporarily unavailable'
      );
      await expect(actions.deleteStatusByIdAction(1)).rejects.toThrow('temporarily unavailable');
      await expect(actions.deleteStatusByUserUserIdAction('admin')).rejects.toThrow(
        'temporarily unavailable'
      );
      for (const spy of [
        fetch,
        transport.post,
        transport.update,
        mocks.create,
        mocks.correct,
        mocks.remove,
        mocks.dbRead,
      ])
        expect(spy).not.toHaveBeenCalled();
    }
  );
  it('restores availability only when the deployment switch is cleared', () => {
    vi.stubEnv('SLACK_HISTORY_IMPORT_MODE', 'rehearsal');
    expect(slackEchoWritesEnabled()).toBe(false);
    vi.stubEnv('SLACK_HISTORY_IMPORT_MODE', 'off');
    expect(slackEchoWritesEnabled()).toBe(true);
    vi.stubEnv('SLACK_HISTORY_IMPORT_MODE', '');
    expect(slackEchoWritesEnabled()).toBe(true);
  });
});
