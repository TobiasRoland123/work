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

describe('sandbox navigation', () => {
  it('hides the sandbox link unless the server grants access, independently of Review', () => {
    const render = (showSandbox: boolean) =>
      renderToStaticMarkup(
        React.createElement(
          AppShell,
          {
            showSandbox,
            showMessageQuality: false,
          } as React.ComponentProps<typeof AppShell>,
          'Content'
        )
      );
    expect(render(false)).not.toContain('/sandbox');
    expect(render(true)).toContain('href="/sandbox"');
    expect(render(true)).not.toContain('/message-quality');
  });
});
