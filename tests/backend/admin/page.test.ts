import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  requirePageUserId: vi.fn(),
  requireAdmin: vi.fn(),
  listUserRoles: vi.fn(),
}));

vi.mock('@/lib/auth/require-user', () => ({ requirePageUserId: mocked.requirePageUserId }));
vi.mock('@/lib/auth/roles', () => ({ requireAdmin: mocked.requireAdmin }));
vi.mock('@/lib/admin/roles', () => ({ listUserRoles: mocked.listUserRoles }));
vi.mock('@/app/actions/roleActions', () => ({ changeUserRoleAction: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/components/layout/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => React.createElement('h1', null, title),
}));
vi.mock('@/app/(authenticated)/employee-stats/employee-stats.css', () => ({}));
vi.mock('@/app/(authenticated)/admin/roles/roles.css', () => ({}));

import RolesPage from '@/app/(authenticated)/admin/roles/page';

beforeEach(() => {
  vi.clearAllMocks();
  mocked.requirePageUserId.mockReset().mockResolvedValue('admin-user');
  mocked.requireAdmin.mockReset().mockResolvedValue('admin-user');
  mocked.listUserRoles.mockReset().mockResolvedValue([
    { userId: 'admin-user', name: 'Anna Attendee', email: 'anna@example.com', role: 'ADMIN' },
    { userId: 'manager-user', name: 'Mads Manager', email: 'mads@example.com', role: 'MANAGER' },
    {
      userId: 'employee-user',
      name: 'Freja Employee',
      email: 'freja@example.com',
      role: 'EMPLOYEE',
    },
  ]);
});

describe('role management page', () => {
  it('requires a session before checking access or reading people', async () => {
    mocked.requirePageUserId.mockRejectedValueOnce(new Error('LOGIN'));
    await expect(RolesPage()).rejects.toThrow('LOGIN');
    expect(mocked.requireAdmin).not.toHaveBeenCalled();
    expect(mocked.listUserRoles).not.toHaveBeenCalled();
  });

  it('blocks managers and employees from reading roles', async () => {
    mocked.requireAdmin.mockRejectedValueOnce(new Error('NOT_FOUND'));
    await expect(RolesPage()).rejects.toThrow('NOT_FOUND');
    expect(mocked.listUserRoles).not.toHaveBeenCalled();
  });

  it('explains the roles and allows changing other people, with the caller read-only', async () => {
    const html = renderToStaticMarkup(await RolesPage());
    expect(html).toContain('Access all features and change other people');
    expect(html).toContain('View employee statistics');
    expect(html).toContain('Role for Mads Manager');
    expect(html).toContain('Role for Freja Employee');
    expect(html).not.toContain('Role for Anna Attendee');
    expect(html).toContain('value="MANAGER" selected=""');
    expect(html).toContain('value="EMPLOYEE" selected=""');
    expect(html).toContain('Ask another admin to change your own role.');
  });
});
