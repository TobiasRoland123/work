import React, { createContext, useContext, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import '@/app/themes.css';
import '@/components/layout/shell.css';

const navState = vi.hoisted(() => ({
  pathname: '/admin/roles',
  pendingHref: null as string | null,
  listeners: new Set<() => void>(),
  reset() {
    navState.pathname = '/admin/roles';
    navState.pendingHref = null;
    navState.listeners.clear();
  },
  setPending(href: string | null) {
    navState.pendingHref = href;
    for (const listener of navState.listeners) listener();
  },
  setPathname(next: string) {
    navState.pathname = next;
    for (const listener of navState.listeners) listener();
  },
  subscribe(listener: () => void) {
    navState.listeners.add(listener);
    return () => {
      navState.listeners.delete(listener);
    };
  },
}));

const LinkHrefContext = createContext<string | null>(null);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/components/pwa/PhoneInvite', () => ({
  PhoneInvite: () => null,
}));

vi.mock('next/navigation', () => ({
  usePathname: () =>
    useSyncExternalStore(navState.subscribe, () => navState.pathname, () => navState.pathname),
}));

vi.mock('next/link', () => {
  function MockLink({
    href,
    children,
    prefetch: _prefetch,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    prefetch?: boolean | null;
  }) {
    void _prefetch;
    return (
      <LinkHrefContext.Provider value={href}>
        <a href={href} {...props}>
          {children}
        </a>
      </LinkHrefContext.Provider>
    );
  }
  function useLinkStatus() {
    const href = useContext(LinkHrefContext);
    const pendingHref = useSyncExternalStore(
      navState.subscribe,
      () => navState.pendingHref,
      () => navState.pendingHref
    );
    return { pending: href !== null && pendingHref === href };
  }
  return { __esModule: true, default: MockLink, useLinkStatus };
});

import { AppShell } from '@/components/layout/AppShell';
import { AppLink, LOADING_UI_DELAY_MS } from '@/components/layout/NavigationFeedback';
import { setTodayReturn } from '@/components/week/todayReturn';

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.useFakeTimers();
  navState.reset();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  setTodayReturn(null);
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.useRealTimers();
});

function StatefulRouteContent({ onMount }: { onMount: () => void }) {
  const mountedRef = useRef(false);
  if (!mountedRef.current) {
    mountedRef.current = true;
    onMount();
  }
  const [count, setCount] = useState(0);
  return (
    <main id="dashboard-main" className="content-page">
      <h1>Current route</h1>
      <button type="button" onClick={() => setCount((value) => value + 1)}>
        Increment {count}
      </button>
      <AppLink href="/employee-stats?days=90">Last 90 days</AppLink>
    </main>
  );
}

it('transfers active highlight, shows route skeleton, and preserves route mount during Roles -> Week', async () => {
  const onMount = vi.fn();
  await act(async () => {
    root.render(
      <AppShell showEmployeeStats showRoleManagement>
        <StatefulRouteContent onMount={onMount} />
      </AppShell>
    );
  });

  const nav = container.querySelector('nav[aria-label="App navigation"]')!;
  const weekLink = nav.querySelector('.office-nav-links a[href="/today"]')!;
  const rolesLink = nav.querySelector('.office-nav-links a[href="/admin/roles"]')!;
  const moreButton = nav.querySelector('.office-nav-more')!;
  const routeWrapper = container.querySelector('.app-shell-route')!;

  expect(rolesLink.getAttribute('aria-current')).toBe('page');
  expect(weekLink.getAttribute('aria-current')).toBeNull();
  expect(moreButton.getAttribute('data-current')).toBe('true');
  expect(onMount).toHaveBeenCalledTimes(1);

  await act(async () => {
    navState.setPending('/today');
  });

  // Nav highlight transfers immediately while avoiding 1-frame skeleton flash before LOADING_UI_DELAY_MS.
  expect(weekLink.getAttribute('data-pending')).toBe('true');
  expect(rolesLink.getAttribute('data-nav-leaving')).toBe('true');
  expect(moreButton.getAttribute('data-nav-leaving')).toBe('true');
  expect(container.querySelector('.app-shell-progress')).toBeNull();
  expect(routeWrapper.hasAttribute('hidden')).toBe(false);

  await act(async () => {
    vi.advanceTimersByTime(LOADING_UI_DELAY_MS);
  });

  expect(container.querySelector('.app-shell-progress')).not.toBeNull();
  expect(container.textContent).toContain('Loading the week overview…');
  expect(routeWrapper.hasAttribute('hidden')).toBe(true);
  // Ensure the pending fallback never creates a duplicate #dashboard-main.
  expect(container.querySelectorAll('#dashboard-main')).toHaveLength(1);
  // Verify the route subtree stayed mounted.
  expect(onMount).toHaveBeenCalledTimes(1);

  await act(async () => {
    navState.setPathname('/today');
    navState.setPending(null);
  });

  expect(weekLink.getAttribute('aria-current')).toBe('page');
  expect(weekLink.getAttribute('data-pending')).toBeNull();
  expect(rolesLink.getAttribute('data-nav-leaving')).toBeNull();
  expect(container.querySelector('.app-shell-progress')).toBeNull();
  expect(routeWrapper.hasAttribute('hidden')).toBe(false);
  expect(container.textContent).not.toContain('Loading the week overview…');
  expect(onMount).toHaveBeenCalledTimes(1);
});

it('skips skeleton and progress flash when a cached transition finishes before LOADING_UI_DELAY_MS', async () => {
  await act(async () => {
    root.render(
      <AppShell showEmployeeStats showRoleManagement>
        <main id="dashboard-main">Roles</main>
      </AppShell>
    );
  });

  const nav = container.querySelector('nav[aria-label="App navigation"]')!;
  const contactLink = nav.querySelector('.office-nav-links a[href="/contact"]')!;
  const rolesLink = nav.querySelector('.office-nav-links a[href="/admin/roles"]')!;
  const routeWrapper = container.querySelector('.app-shell-route')!;

  await act(async () => {
    navState.setPending('/contact');
  });

  expect(contactLink.getAttribute('data-pending')).toBe('true');
  expect(rolesLink.getAttribute('data-nav-leaving')).toBe('true');

  await act(async () => {
    vi.advanceTimersByTime(LOADING_UI_DELAY_MS - 35);
  });
  expect(container.querySelector('.app-shell-progress')).toBeNull();
  expect(routeWrapper.hasAttribute('hidden')).toBe(false);

  await act(async () => {
    navState.setPathname('/contact');
    navState.setPending(null);
  });

  expect(contactLink.getAttribute('aria-current')).toBe('page');
  expect(contactLink.getAttribute('data-pending')).toBeNull();
  expect(rolesLink.getAttribute('data-nav-leaving')).toBeNull();
  expect(container.querySelector('.app-shell-progress')).toBeNull();
});

it('switches pending target cleanly on rapid clicks without restarting the loading timer', async () => {
  await act(async () => {
    root.render(
      <AppShell showEmployeeStats showRoleManagement>
        <main id="dashboard-main">Roles</main>
      </AppShell>
    );
  });

  const nav = container.querySelector('nav[aria-label="App navigation"]')!;
  const weekLink = nav.querySelector('.office-nav-links a[href="/today"]')!;
  const contactLink = nav.querySelector('.office-nav-links a[href="/contact"]')!;

  await act(async () => {
    navState.setPending('/today');
  });
  await act(async () => {
    vi.advanceTimersByTime(LOADING_UI_DELAY_MS);
  });
  expect(weekLink.getAttribute('data-pending')).toBe('true');
  expect(container.textContent).toContain('Loading the week overview…');

  await act(async () => {
    navState.setPending('/contact');
  });
  expect(weekLink.getAttribute('data-pending')).toBeNull();
  expect(contactLink.getAttribute('data-pending')).toBe('true');
  expect(container.textContent).toContain('Loading colleagues…');
});

it('shows progress bar and link pending cue for same-page query links without hiding content', async () => {
  navState.pathname = '/employee-stats';
  await act(async () => {
    root.render(
      <AppShell showEmployeeStats showRoleManagement>
        <StatefulRouteContent onMount={() => {}} />
      </AppShell>
    );
  });

  const filterLink = container.querySelector('a[href="/employee-stats?days=90"]')!;
  const routeWrapper = container.querySelector('.app-shell-route')!;
  const statsNavLink = container.querySelector('nav[aria-label="App navigation"] a[href="/employee-stats"]')!;

  await act(async () => {
    navState.setPending('/employee-stats?days=90');
  });

  expect(filterLink.getAttribute('data-pending')).toBe('true');
  expect(routeWrapper.hasAttribute('hidden')).toBe(false);
  expect(statsNavLink.getAttribute('data-nav-leaving')).toBeNull();

  await act(async () => {
    vi.advanceTimersByTime(LOADING_UI_DELAY_MS);
  });

  expect(container.querySelector('.app-shell-progress')).not.toBeNull();
  expect(routeWrapper.hasAttribute('hidden')).toBe(false);

  await act(async () => {
    navState.setPending(null);
  });
  expect(filterLink.getAttribute('data-pending')).toBeNull();
  expect(container.querySelector('.app-shell-progress')).toBeNull();
});

it('switches the Week tab into a return-to-today action when viewing another date or week', async () => {
  navState.pathname = '/today';
  const jump = vi.fn();

  await act(async () => {
    root.render(
      <AppShell>
        <main id="dashboard-main">Week</main>
      </AppShell>
    );
  });

  const nav = container.querySelector('nav[aria-label="App navigation"]')!;
  const weekLink = nav.querySelector('.office-nav-links > a') as HTMLAnchorElement;
  expect(weekLink.getAttribute('data-return-today')).toBeNull();

  await act(async () => {
    setTodayReturn({ direction: 'earlier', href: '/today?week=2026-11-23', jump });
  });

  expect(weekLink.getAttribute('data-return-today')).toBe('earlier');
  expect(weekLink.getAttribute('href')).toBe('/today?week=2026-11-23');
  expect(weekLink.querySelector('.office-nav-return-today')?.textContent).toContain('Today');

  await act(async () => {
    weekLink.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  });
  expect(jump).toHaveBeenCalledTimes(1);

  await act(async () => {
    setTodayReturn(null);
  });
  expect(weekLink.getAttribute('data-return-today')).toBeNull();
});
