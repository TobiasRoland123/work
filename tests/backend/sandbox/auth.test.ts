import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JWT } from 'next-auth/jwt';
import { applySandboxSignIn, SANDBOX_PROVIDER_ID, sandboxProviders } from '@/lib/sandbox/auth';

// Auth.js keeps user-supplied provider options under `options` until it merges them per request.
type CredentialsProvider = {
  type: string;
  options?: { id?: string; authorize?: (credentials: unknown, request: Request) => unknown };
};

const select = vi.hoisted(() => vi.fn());
vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: select }) }),
    }),
  },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  select.mockReset();
});

const account = {
  provider: SANDBOX_PROVIDER_ID,
  providerAccountId: 'x',
  type: 'credentials' as const,
};

describe('sandbox credentials provider', () => {
  it('is not registered in production builds', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(sandboxProviders()).toEqual([]);
  });
  it('is registered outside production under its own id', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const [provider] = sandboxProviders() as CredentialsProvider[];
    expect(provider.type).toBe('credentials');
    expect(provider.options?.id).toBe(SANDBOX_PROVIDER_ID);
  });
  it('authorizes only active profiles of the sandbox workspace', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const [provider] = sandboxProviders() as CredentialsProvider[];
    const authorize = provider.options!.authorize!;
    const request = new Request('http://127.0.0.1:3000/api/auth/callback/sandbox');
    select.mockResolvedValueOnce([{ id: 'sandbox-user' }]);
    await expect(authorize({ userId: 'sandbox-user' }, request)).resolves.toEqual({
      id: 'sandbox-user',
    });
    select.mockResolvedValueOnce([]);
    await expect(authorize({ userId: 'deactivated' }, request)).resolves.toBeNull();
    await expect(authorize({}, request)).resolves.toBeNull();
    expect(select).toHaveBeenCalledTimes(2);
  });
});

describe('sandbox sign-in claim', () => {
  it('masquerades as the Slack provider and records the truth for display', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const token: JWT = { provider: SANDBOX_PROVIDER_ID };
    expect(applySandboxSignIn(token, account, { id: 'sandbox-user' })).toEqual({
      provider: 'slack',
      sub: 'sandbox-user',
      userId: 'sandbox-user',
      sandbox: true,
    });
  });
  it('leaves the token untouched in production builds', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const token: JWT = { provider: SANDBOX_PROVIDER_ID };
    expect(applySandboxSignIn(token, account, { id: 'sandbox-user' })).toEqual({
      provider: SANDBOX_PROVIDER_ID,
    });
  });
  it('ignores sign-ins through other providers', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const token: JWT = { provider: 'slack', userId: 'real' };
    expect(applySandboxSignIn(token, { ...account, provider: 'slack' }, { id: 'other' })).toEqual({
      provider: 'slack',
      userId: 'real',
    });
  });
});
