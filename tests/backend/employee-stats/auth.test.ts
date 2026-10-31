import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ requireUserId: vi.fn(), getUserRole: vi.fn() }));
vi.mock('@/lib/auth/require-user', () => ({ requireUserId: auth.requireUserId }));
vi.mock('@/lib/auth/roles', () => ({
  getUserRole: auth.getUserRole,
  isAdmin: async (userId: string) => (await auth.getUserRole(userId)) === 'ADMIN',
  activeWorkspaceMember: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));

import {
  canViewEmployeeStats,
  isEmployeeStatsAdmin,
  requireEmployeeStatsAdmin,
  requireEmployeeStatsViewer,
} from '@/lib/auth/employee-stats';
import { ADMIN_SLACK_IDENTITY } from '@/lib/auth/admin-identity';
import { isInitialAdmin } from '@/lib/auth/message-review-defaults';

beforeEach(() => {
  auth.requireUserId.mockReset().mockResolvedValue('selected-user');
  auth.getUserRole.mockReset().mockResolvedValue(null);
});

describe('employee stats role hierarchy', () => {
  it.each(['ADMIN', 'MANAGER'])('allows %s to read stats', async (role) => {
    auth.getUserRole.mockResolvedValue(role);
    await expect(requireEmployeeStatsViewer()).resolves.toBe('selected-user');
  });

  it.each(['EMPLOYEE', null])('rejects stats for role %s', async (role) => {
    auth.getUserRole.mockResolvedValue(role);
    await expect(requireEmployeeStatsViewer()).rejects.toThrow('NOT_FOUND');
  });

  it('does not let a manager administer roles', async () => {
    auth.getUserRole.mockResolvedValue('MANAGER');
    await expect(requireEmployeeStatsAdmin()).rejects.toThrow('NOT_FOUND');
  });

  it('allows an admin to administer roles', async () => {
    auth.getUserRole.mockResolvedValue('ADMIN');
    await expect(requireEmployeeStatsAdmin()).resolves.toBe('selected-user');
  });

  it('does not grant permanent access through the initial admin identity', async () => {
    auth.getUserRole.mockResolvedValue('EMPLOYEE');
    await expect(canViewEmployeeStats(ADMIN_SLACK_IDENTITY.slackUserId)).resolves.toBe(false);
    await expect(isEmployeeStatsAdmin(ADMIN_SLACK_IDENTITY.slackUserId)).resolves.toBe(false);
  });

  it('rejects an unauthenticated request before reading a role', async () => {
    auth.requireUserId.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(requireEmployeeStatsViewer()).rejects.toThrow('NOT_FOUND');
    expect(auth.getUserRole).not.toHaveBeenCalled();
  });

  it('bootstraps only the exact verified initial admin identity', () => {
    expect(isInitialAdmin('T02HKL21R', 'U05NP1NF3QB')).toBe(true);
    expect(isInitialAdmin('T02HKL21R', 'U_OTHER')).toBe(false);
    expect(isInitialAdmin('T_OTHER', 'U05NP1NF3QB')).toBe(false);
  });
});
