'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarDays,
  FlaskConical,
  Menu,
  MessageSquareWarning,
  Users,
  UserRound,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { isSandbox } from '@/lib/sandbox/enabled';
import './shell.css';

const links = [
  { href: '/today', label: 'Week', Icon: CalendarDays, prefetch: null },
  { href: '/contact', label: 'Contact', Icon: Users, prefetch: true },
  { href: '/profile', label: 'Profile', Icon: UserRound, prefetch: true },
];

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

export function AppShell({
  children,
  firstName,
  showMessageQuality = false,
}: {
  children: ReactNode;
  firstName?: string | null;
  showMessageQuality?: boolean;
}) {
  const pathname = usePathname();
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const special = [...(showMessageQuality ? [reviewLink] : []), ...specialLinks];
  const specialIsCurrent = special.some(({ href }) => pathname === href);

  const renderLink = (
    { href, label, Icon, prefetch }: (typeof links)[number],
    onClick?: () => void
  ) => (
    <Link
      key={href}
      href={href}
      prefetch={prefetch}
      aria-current={pathname === href ? 'page' : undefined}
      onClick={onClick}
    >
      <Icon size={21} aria-hidden="true" />
      {label}
    </Link>
  );

  return (
    <div className="app-shell">
      <a href="#dashboard-main" className="skip-navigation">
        Skip to content
      </a>
      <nav className="office-rail" aria-label="App navigation">
        <Link href="/today" className="office-wordmark" aria-label="WØRK home">
          WØRK
        </Link>
        <div className="office-nav-links">
          {links.map((link) => renderLink(link))}
          {special.length > 0 && (
            <>
              <button
                type="button"
                className="office-nav-more"
                popoverTarget="office-nav-special"
                data-current={specialIsCurrent || undefined}
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
        <Link href="/profile" prefetch={true} className="office-me">
          <span>{firstName?.[0] || 'W'}</span>
          <small>{firstName || 'My profile'}</small>
        </Link>
      </nav>
      <div className="app-shell-content">{children}</div>
    </div>
  );
}
