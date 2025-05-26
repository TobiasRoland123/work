import { vi, describe, it, expect } from 'vitest';

// Mock @/auth entirely BEFORE importing your functions
vi.mock('@/auth', () => ({
  signIn: vi.fn().mockResolvedValue(undefined),
  signOut: vi.fn().mockResolvedValue(undefined),
}));

import { login, logout } from '@/lib/actions/auth'; // Adjust path as needed

describe('auth', () => {
  it('calls signIn with MicrosoftEntraID and correct options', async () => {
    const { signIn } = await import('@/auth');
    await login();
    expect(signIn).toHaveBeenCalledWith('MicrosoftEntraID', { redirectTo: '/' });
  });

  it('calls signOut with correct options', async () => {
    const { signOut } = await import('@/auth');
    await logout();
    expect(signOut).toHaveBeenCalledWith({ redirectTo: '/' });
  });
});
