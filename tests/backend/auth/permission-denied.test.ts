import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ requirePageUserId: vi.fn() }));
vi.mock('@/lib/auth/require-user', () => ({ requirePageUserId: auth.requirePageUserId }));
vi.mock('@/components/layout/PageHeader', () => ({
  PageHeader: ({ title, subtitle }: { title: string; subtitle: string }) =>
    React.createElement('header', null, React.createElement('h1', null, title), subtitle),
}));

vi.mock('@/components/ui/Button/button.css', () => ({}));

import PermissionDeniedPage from '@/app/(authenticated)/permission-denied/page';

beforeEach(() => auth.requirePageUserId.mockReset());

describe('permission denied page', () => {
  it('requires a session', async () => {
    auth.requirePageUserId.mockRejectedValueOnce(new Error('REDIRECT:/login'));
    await expect(PermissionDeniedPage()).rejects.toThrow('REDIRECT:/login');
  });

  it('explains access and offers a way back for any signed-in account', async () => {
    auth.requirePageUserId.mockResolvedValueOnce('employee');
    const html = renderToStaticMarkup(await PermissionDeniedPage());
    expect(auth.requirePageUserId).toHaveBeenCalledOnce();
    expect(html).toContain('<h1>You do not have permission</h1>');
    expect(html).toContain('Your account does not have access to this page.');
    expect(html).toContain('Contact your workspace admin');
    expect(html).toContain('href="/today"');
    expect(html).toContain('Back to Today</a>');
  });
});
