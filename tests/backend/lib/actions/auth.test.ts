import { beforeEach, describe, expect, it, vi } from 'vitest';

const { signIn, signOut } = vi.hoisted(() => ({ signIn: vi.fn(), signOut: vi.fn() }));
vi.mock('@/auth', () => ({ signIn, signOut }));
import { login, logout } from '@/lib/actions/auth';

beforeEach(() => {
  signIn.mockReset();
  signOut.mockReset();
});

describe('authentication actions', () => {
  it('starts Slack sign-in and returns its result', async () => {
    signIn.mockResolvedValue('sign-in result');
    await expect(login()).resolves.toBe('sign-in result');
    expect(signIn).toHaveBeenCalledExactlyOnceWith('slack', { redirectTo: '/' });
    expect(signOut).not.toHaveBeenCalled();
  });
  it('signs out and returns its result', async () => {
    signOut.mockResolvedValue('sign-out result');
    await expect(logout()).resolves.toBe('sign-out result');
    expect(signOut).toHaveBeenCalledExactlyOnceWith({ redirectTo: '/' });
    expect(signIn).not.toHaveBeenCalled();
  });
  it.each(['login', 'logout'] as const)(
    'propagates the Auth.js redirect from %s',
    async (action) => {
      const redirect = new Error('NEXT_REDIRECT');
      (action === 'login' ? signIn : signOut).mockRejectedValue(redirect);
      await expect(action === 'login' ? login() : logout()).rejects.toBe(redirect);
    }
  );
});
