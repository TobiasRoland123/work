'use client';

import React, { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from 'react';
import { usePathname } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChartColumn,
  ChartNoAxesCombined,
  Coins,
  FlaskConical,
  Menu,
  MessageSquareWarning,
  ShieldCheck,
  Users,
  UserRound,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { isSandbox } from '@/lib/sandbox/enabled';
import { PhoneInvite } from '@/components/pwa/PhoneInvite';
import {
  readWeekScope,
  subscribeWeekScope,
  weekEntryHref,
} from '@/components/week/scopePreference';
import { getTodayReturn, subscribeTodayReturn } from '@/components/week/todayReturn';
import {
  AppLink,
  NavigationFeedbackProvider,
  useNavigationFeedback,
} from './NavigationFeedback';
import { RouteLoadingFallback } from './RouteLoadingFallback';
import './shell.css';

// Shown inline on desktop and behind the "More" menu button on mobile.
const specialLinks = [
  // Local development only; production builds never render this entry.
  ...(isSandbox()
    ? [{ href: '/sandbox', label: 'Sandbox', Icon: FlaskConical, prefetch: null }]
    : []),
];

const reviewLink = {
  href: '/message-quality',
  label: 'Review',
  Icon: MessageSquareWarning,
  prefetch: null,
};

const aiCostLink = { href: '/ai-cost', label: 'AI cost', Icon: Coins, prefetch: null };

const employeeStatsLink = {
  href: '/employee-stats',
  label: 'Stats',
  Icon: ChartColumn,
  prefetch: null,
};

const rolesLink = {
  href: '/admin/roles',
  label: 'Roles',
  Icon: ShieldCheck,
  prefetch: null,
};

// Keep Stats selected on individual employee pages. Roles has its own navigation entry.
export const isCurrentPath = (pathname: string | null, href: string) => {
  const target = href.split('#', 1)[0].split('?', 1)[0];
  return (
    pathname === target ||
    (target === '/employee-stats' && Boolean(pathname?.startsWith('/employee-stats/people')))
  );
};

type NavLinkItem = {
  href: string;
  label: string;
  Icon: typeof CalendarDays;
  prefetch: boolean | null;
};

function AppShellFrame({
  children,
  showPhoneInvite,
  firstName,
  showMessageQuality,
  showEmployeeStats,
  showRoleManagement,
  initialWeekHref,
}: {
  children: ReactNode;
  showPhoneInvite: boolean;
  firstName?: string | null;
  showMessageQuality: boolean;
  showEmployeeStats: boolean;
  showRoleManagement: boolean;
  initialWeekHref: string;
}) {
  const pathname = usePathname();
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const [weekHref, setWeekHref] = useState(initialWeekHref);
  const { showLoadingUi, pendingRoutePathname } = useNavigationFeedback();
  const todayReturn = useSyncExternalStore(subscribeTodayReturn, getTodayReturn, () => null);
  const activeTodayReturn =
    isCurrentPath(pathname, '/today') && pendingRoutePathname === null ? todayReturn : null;

  useEffect(() => {
    const sync = () => setWeekHref(weekEntryHref(readWeekScope()));
    sync();
    return subscribeWeekScope(sync);
  }, [pathname]);

  const links: NavLinkItem[] = [
    { href: weekHref, label: 'Week', Icon: CalendarDays, prefetch: null },
    { href: '/contact', label: 'Contact', Icon: Users, prefetch: true },
    { href: '/profile', label: 'Profile', Icon: UserRound, prefetch: true },
  ];

  const special: NavLinkItem[] = [
    { href: '/my-stats', label: 'My stats', Icon: ChartNoAxesCombined, prefetch: null },
    ...(showMessageQuality ? [reviewLink, aiCostLink] : []),
    ...(showEmployeeStats ? [employeeStatsLink] : []),
    ...(showRoleManagement ? [rolesLink] : []),
    ...specialLinks,
  ];

  const specialIsCurrent = special.some(({ href }) => isCurrentPath(pathname, href));
  const pendingSpecial =
    pendingRoutePathname !== null &&
    special.some(({ href }) => isCurrentPath(pendingRoutePathname, href));

  const renderLink = ({ href, label, Icon, prefetch }: NavLinkItem, onClick?: () => void) => {
    const current = isCurrentPath(pathname, href);
    const pendingTarget =
      pendingRoutePathname !== null && isCurrentPath(pendingRoutePathname, href);
    const leaving = pendingRoutePathname !== null && current && !pendingTarget;
    const returnToday = label === 'Week' ? activeTodayReturn : null;
    const resolvedHref = returnToday ? returnToday.href : href;
    const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.();
      if (
        returnToday &&
        event.button === 0 &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey
      ) {
        event.preventDefault();
        returnToday.jump();
      }
    };
    return (
      <AppLink
        key={label}
        href={resolvedHref}
        prefetch={prefetch}
        aria-current={current ? 'page' : undefined}
        data-pending={pendingTarget ? 'true' : undefined}
        data-nav-leaving={leaving ? 'true' : undefined}
        data-return-today={returnToday ? returnToday.direction : undefined}
        onClick={handleClick}
      >
        {returnToday ? (
          <>
            <span className="office-nav-default">
              <Icon size={21} aria-hidden="true" />
              {label}
            </span>
            <span className="office-nav-return-today">
              {returnToday.direction === 'earlier' ? (
                <ArrowLeft size={21} aria-hidden="true" />
              ) : (
                <ArrowRight size={21} aria-hidden="true" />
              )}
              Today
            </span>
          </>
        ) : (
          <>
            <Icon size={21} aria-hidden="true" />
            {label}
          </>
        )}
      </AppLink>
    );
  };

  const pendingFallback =
    showLoadingUi && pendingRoutePathname ? (
      <RouteLoadingFallback pathname={pendingRoutePathname} />
    ) : null;

  return (
    <div className="app-shell">
      <a href="#dashboard-main" className="skip-navigation">
        Skip to content
      </a>
      <nav className="office-rail" aria-label="App navigation">
        <AppLink href={weekHref} prefetch={null} className="office-wordmark" aria-label="WØRK home">
          WØRK
        </AppLink>
        <div className="office-nav-links">
          {links.map((link) => renderLink(link))}
          {special.length > 0 && (
            <>
              <button
                type="button"
                className="office-nav-more"
                popoverTarget="office-nav-special"
                data-current={specialIsCurrent || undefined}
                data-pending={pendingSpecial ? 'true' : undefined}
                data-nav-leaving={
                  pendingRoutePathname !== null && specialIsCurrent && !pendingSpecial
                    ? 'true'
                    : undefined
                }
              >
                <Menu size={21} aria-hidden="true" />
                More
              </button>
              <div
                ref={moreMenuRef}
                id="office-nav-special"
                className="office-nav-special"
                popover="auto"
              >
                {special.map((link) =>
                  renderLink(link, () => moreMenuRef.current?.hidePopover?.())
                )}
              </div>
            </>
          )}
        </div>
        <AppLink
          href="/profile"
          prefetch={true}
          className="office-me"
          title={firstName || 'My profile'}
          aria-label={firstName ? `Profile for ${firstName}` : 'My profile'}
        >
          <span aria-hidden="true">{firstName?.[0] || 'W'}</span>
          <small>{firstName || 'My profile'}</small>
        </AppLink>
      </nav>
      <div className="app-shell-content">
        {showLoadingUi && <div className="app-shell-progress" aria-hidden="true" />}
        {pendingFallback}
        <div
          className="app-shell-route"
          hidden={Boolean(pendingFallback)}
          aria-hidden={pendingFallback ? true : undefined}
        >
          {children}
        </div>
      </div>
      {showPhoneInvite && <PhoneInvite />}
    </div>
  );
}

export function AppShell({
  children,
  showPhoneInvite = false,
  firstName,
  showMessageQuality = false,
  showEmployeeStats = false,
  showRoleManagement = false,
  initialWeekHref = '/today',
}: {
  children: ReactNode;
  /** True until the person has closed the phone app invitation. */
  showPhoneInvite?: boolean;
  firstName?: string | null;
  showMessageQuality?: boolean;
  showEmployeeStats?: boolean;
  showRoleManagement?: boolean;
  initialWeekHref?: string;
}) {
  return (
    <NavigationFeedbackProvider>
      <AppShellFrame
        showPhoneInvite={showPhoneInvite}
        firstName={firstName}
        showMessageQuality={showMessageQuality}
        showEmployeeStats={showEmployeeStats}
        showRoleManagement={showRoleManagement}
        initialWeekHref={initialWeekHref}
      >
        {children}
      </AppShellFrame>
    </NavigationFeedbackProvider>
  );
}
