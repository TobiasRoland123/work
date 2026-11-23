'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import Link, * as NextLink from 'next/link';
import * as NextNavigation from 'next/navigation';

const fallbackUseLinkStatus = () => ({ pending: false });
const fallbackUsePathname = () => null;

const useSafeLinkStatus: () => { pending: boolean } = (() => {
  try {
    return typeof NextLink.useLinkStatus === 'function'
      ? NextLink.useLinkStatus
      : fallbackUseLinkStatus;
  } catch {
    return fallbackUseLinkStatus;
  }
})();

const useSafePathname: () => string | null = (() => {
  try {
    return typeof NextNavigation.usePathname === 'function'
      ? NextNavigation.usePathname
      : fallbackUsePathname;
  } catch {
    return fallbackUsePathname;
  }
})();

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export const LOADING_UI_DELAY_MS = 60;

type PendingNavigation = {
  id: string;
  targetHref: string;
  targetPathname: string;
  fromPathname: string;
  episodeId: number;
};

type NavigationFeedbackValue = {
  isPending: boolean;
  showLoadingUi: boolean;
  pendingLinkId: string | null;
  pendingRoutePathname: string | null;
  reportPending: (id: string, targetHref: string, pending: boolean) => void;
};

const noop = () => {};

const NavigationFeedbackContext = createContext<NavigationFeedbackValue>({
  isPending: false,
  showLoadingUi: false,
  pendingLinkId: null,
  pendingRoutePathname: null,
  reportPending: noop,
});

export function isInternalPathHref(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//');
}

export function hrefPathname(href: string): string {
  const [withoutHash] = href.split('#', 1);
  const [pathname] = withoutHash.split('?', 1);
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
  return pathname || '/';
}

export function NavigationFeedbackProvider({ children }: { children: ReactNode }) {
  const rawPathname = useSafePathname();
  const currentPathname = rawPathname === null ? '' : hrefPathname(rawPathname);
  const pathnameRef = useRef(currentPathname);
  pathnameRef.current = currentPathname;

  const nextEpisodeRef = useRef(0);
  const activeNavRef = useRef<PendingNavigation | null>(null);
  const justClearedRef = useRef<{ fromPathname: string; episodeId: number } | null>(null);
  const [pendingNav, setPendingNav] = useState<PendingNavigation | null>(null);
  const [readyEpisodeId, setReadyEpisodeId] = useState<number | null>(null);
  activeNavRef.current = pendingNav;

  useIsomorphicLayoutEffect(() => {
    justClearedRef.current = null;
  });

  const reportPending = useCallback((id: string, targetHref: string, pending: boolean) => {
    if (pending) {
      const current = activeNavRef.current;
      const cleared = justClearedRef.current;
      justClearedRef.current = null;
      const continuedEpisodeId =
        current && current.fromPathname === pathnameRef.current
          ? current.episodeId
          : cleared && cleared.fromPathname === pathnameRef.current
            ? cleared.episodeId
            : null;
      const episodeId = continuedEpisodeId ?? ++nextEpisodeRef.current;
      const nextNav: PendingNavigation = {
        id,
        targetHref,
        targetPathname: hrefPathname(targetHref),
        fromPathname: pathnameRef.current,
        episodeId,
      };
      activeNavRef.current = nextNav;
      setPendingNav(nextNav);
    } else {
      const current = activeNavRef.current;
      if (current?.id === id) {
        justClearedRef.current = {
          fromPathname: current.fromPathname,
          episodeId: current.episodeId,
        };
        activeNavRef.current = null;
        queueMicrotask(() => {
          justClearedRef.current = null;
        });
      }
      setPendingNav((previous) => (previous?.id === id ? null : previous));
    }
  }, []);

  // Clearing on pathname change guarantees stale pending UI vanishes in the same render as commit.
  const active = pendingNav && pendingNav.fromPathname === currentPathname ? pendingNav : null;
  const activeEpisodeId = active?.episodeId ?? null;

  useEffect(() => {
    if (activeEpisodeId === null) return;
    const timer = window.setTimeout(() => {
      setReadyEpisodeId(activeEpisodeId);
    }, LOADING_UI_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [activeEpisodeId]);

  const value = useMemo<NavigationFeedbackValue>(() => {
    const isPending = Boolean(active);
    const showLoadingUi = activeEpisodeId !== null && readyEpisodeId === activeEpisodeId;
    const pendingRoutePathname =
      active && active.targetPathname !== currentPathname ? active.targetPathname : null;
    return {
      isPending,
      showLoadingUi,
      pendingLinkId: active?.id ?? null,
      pendingRoutePathname,
      reportPending,
    };
  }, [active, activeEpisodeId, currentPathname, readyEpisodeId, reportPending]);

  return (
    <NavigationFeedbackContext.Provider value={value}>
      {children}
    </NavigationFeedbackContext.Provider>
  );
}

export function useNavigationFeedback() {
  return useContext(NavigationFeedbackContext);
}

function LinkPendingBridge({
  linkId,
  targetHref,
  reportPending,
}: {
  linkId: string;
  targetHref: string;
  reportPending: (id: string, targetHref: string, pending: boolean) => void;
}) {
  const { pending } = useSafeLinkStatus();

  useIsomorphicLayoutEffect(() => {
    if (!pending) return;
    reportPending(linkId, targetHref, true);
    return () => reportPending(linkId, targetHref, false);
  }, [pending, linkId, targetHref, reportPending]);

  return null;
}

type AppLinkProps = ComponentProps<typeof Link> & {
  'data-pending'?: string;
};

const LinkComponent = (
  typeof Link === 'function'
    ? Link
    : ((Link as unknown as { default?: typeof Link })?.default ?? Link)
) as typeof Link;

/**
 * Drop-in wrapper over next/link that reports pending navigation to AppShell
 * so cross-page switches show immediate navigation and loading feedback.
 */
export function AppLink({
  href,
  children,
  'data-pending': dataPending,
  ...props
}: AppLinkProps) {
  const linkId = useId();
  const { pendingLinkId, reportPending } = useNavigationFeedback();
  const track = typeof href === 'string' && isInternalPathHref(href);

  return (
    <LinkComponent
      href={href}
      data-pending={dataPending ?? (track && pendingLinkId === linkId ? 'true' : undefined)}
      {...props}
    >
      {track && (
        <LinkPendingBridge linkId={linkId} targetHref={href} reportPending={reportPending} />
      )}
      {children}
    </LinkComponent>
  );
}
