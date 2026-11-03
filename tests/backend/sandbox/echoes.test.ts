import { afterEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({ runEchoJob: vi.fn() }));
vi.mock('@/auth', () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));
vi.mock('@/lib/sandbox/service', () => ({}));
vi.mock('@/lib/sandbox/profiles', () => ({ seedSandboxProfiles: vi.fn() }));
vi.mock('@/lib/services/echoService', async (original) => ({
  ...(await original<typeof import('@/lib/services/echoService')>()),
  runEchoJob: mocked.runEchoJob,
}));

import { postSandboxEchoesNowAction } from '@/app/actions/sandboxActions';
import {
  defaultEchoTransport,
  sandboxEchoTransport,
  slackEchoTransport,
} from '@/lib/services/echoService';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('Sandbox Echoes', () => {
  it('never reach Slack outside production builds', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(defaultEchoTransport()).toBe(sandboxEchoTransport);
    vi.stubEnv('NODE_ENV', 'production');
    expect(defaultEchoTransport()).toBe(slackEchoTransport);
  });

  it('can be posted on demand in the sandbox, through the sandbox transport only', async () => {
    mocked.runEchoJob.mockResolvedValue({
      posted: 1,
      retrying: 0,
      updated: 0,
      failed: 0,
      withdrawn: 0,
    });
    await expect(postSandboxEchoesNowAction()).resolves.toMatchObject({ ok: true });
    expect(mocked.runEchoJob).toHaveBeenCalledWith({
      force: true,
      transport: sandboxEchoTransport,
    });
  });

  it('cannot be posted on demand in a production build', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(postSandboxEchoesNowAction()).rejects.toThrow('disabled');
    expect(mocked.runEchoJob).not.toHaveBeenCalled();
  });
});
