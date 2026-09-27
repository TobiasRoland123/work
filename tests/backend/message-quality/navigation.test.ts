import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/layout/shell.css', () => ({}));
vi.mock('next/navigation', () => ({ usePathname: () => '/today' }));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href }, children),
}));

import { AppShell } from '@/components/layout/AppShell';

describe('message review navigation', () => {
  const renderShell = (showMessageQuality = false) =>
    renderToStaticMarkup(
      React.createElement(
        AppShell,
        { showMessageQuality } as React.ComponentProps<typeof AppShell>,
        'Content'
      )
    );

  it('does not expose the link to ordinary users', () => {
    const html = renderShell();
    expect(html).not.toContain('/message-quality');
    expect(html).not.toContain('Review');
  });

  it('shows the link only when the server passed reviewer access', () => {
    const html = renderShell(true);
    expect(html).toContain('href="/message-quality"');
  });
});
