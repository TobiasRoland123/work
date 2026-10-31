import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/layout/shell.css', () => ({}));
vi.mock('next/navigation', () => ({ usePathname: () => '/today' }));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href }, children),
}));

import { AppShell, isCurrentPath } from '@/components/layout/AppShell';

describe('employee stats navigation', () => {
  const renderShell = (props: { showEmployeeStats?: boolean; showRoleManagement?: boolean } = {}) =>
    renderToStaticMarkup(
      React.createElement(AppShell, props as React.ComponentProps<typeof AppShell>, 'Content')
    );

  it('does not expose either link to ordinary users', () => {
    const html = renderShell();
    expect(html).not.toContain('/employee-stats');
    expect(html).not.toContain('Roles');
  });

  it('shows the stats link to a manager but not the access controls', () => {
    const html = renderShell({ showEmployeeStats: true });
    expect(html).toContain('href="/employee-stats"');
    expect(html).not.toContain('/admin/roles');
  });

  it('shows the access controls to the admin', () => {
    const html = renderShell({ showEmployeeStats: true, showRoleManagement: true });
    expect(html).toContain('href="/employee-stats"');
    expect(html).toContain('href="/admin/roles"');
  });
});

describe('highlighting the stats link', () => {
  it('stays on Stats for the overview and every employee page, but not for the access controls', () => {
    expect(isCurrentPath('/employee-stats', '/employee-stats')).toBe(true);
    expect(isCurrentPath('/employee-stats/people', '/employee-stats')).toBe(true);
    expect(isCurrentPath('/employee-stats/people/abc', '/employee-stats')).toBe(true);
    expect(isCurrentPath('/admin/roles', '/employee-stats')).toBe(false);
    expect(isCurrentPath('/admin/roles', '/admin/roles')).toBe(true);
    expect(isCurrentPath('/employee-stats/people', '/admin/roles')).toBe(false);
    expect(isCurrentPath('/today', '/employee-stats')).toBe(false);
    expect(isCurrentPath(null, '/employee-stats')).toBe(false);
  });
});
