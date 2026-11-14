import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({ guard: vi.fn(), select: vi.fn(), transaction: vi.fn() }));
vi.mock('@/db', () => ({ db: { select: mocked.select, transaction: mocked.transaction } }));
vi.mock('@/lib/auth/roles', () => ({
  requireAdmin: mocked.guard,
  activeWorkspaceMember: vi.fn(),
}));
vi.mock('@/lib/auth/employee-stats', () => ({
  requireEmployeeStatsViewer: mocked.guard,
  activeWorkspaceMember: vi.fn(),
}));
vi.mock('@/lib/auth/message-review', () => ({ requireMessageReviewer: mocked.guard }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { getEmployeeStats, getEmployeeProfile, listEmployees } from '@/lib/employee-stats/service';
import { listUserRoles } from '@/lib/admin/roles';
import { getMessageQualityDashboard } from '@/lib/message-quality/service';
import { getAiCostDashboard } from '@/lib/ai-cost/service';
import { changeUserRoleAction } from '@/app/actions/roleActions';
import { saveExpectedStatusAction } from '@/app/actions/messageQualityActions';

beforeEach(() => vi.clearAllMocks());

describe('permission redirect boundaries', () => {
  it.each([
    ['stats', () => getEmployeeStats({})],
    ['directory', () => listEmployees()],
    ['profile', () => getEmployeeProfile({ userId: 'colleague' })],
    ['roles', () => listUserRoles()],
    ['message review', () => getMessageQualityDashboard({})],
    ['AI costs', () => getAiCostDashboard({})],
    ['role action', () => changeUserRoleAction({ userId: 'colleague', role: 'ADMIN' })],
    [
      'review action',
      () =>
        saveExpectedStatusAction({
          messageKey: 'message',
          revision: '1234567890.123456',
          status: 'IN_OFFICE',
          note: '',
        }),
    ],
  ])('propagates the redirect before %s reads or writes protected data', async (_, run) => {
    const redirect = Object.assign(new Error('NEXT_REDIRECT'), {
      digest: 'NEXT_REDIRECT;replace;/permission-denied;307;',
    });
    mocked.guard.mockRejectedValueOnce(redirect);
    await expect(run()).rejects.toBe(redirect);
    expect(mocked.select).not.toHaveBeenCalled();
    expect(mocked.transaction).not.toHaveBeenCalled();
  });
});
