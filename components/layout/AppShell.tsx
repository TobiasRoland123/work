'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, FlaskConical, MessageSquareWarning, Users, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import './shell.css';

const links = [
  { href: '/today', label: 'Week', Icon: CalendarDays, prefetch: null },
  { href: '/contact', label: 'Contact', Icon: Users, prefetch: true },
  { href: '/profile', label: 'Profile', Icon: UserRound, prefetch: true },
];

export function AppShell({
  children,
  firstName,
  showMessageQuality = false,
  showSandbox = false,
}: {
  children: ReactNode;
  firstName?: string | null;
  showMessageQuality?: boolean;
  showSandbox?: boolean;
}) {
  const pathname = usePathname();
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
          {[
            ...links,
            ...(showSandbox
              ? [{ href: '/sandbox', label: 'Sandbox', Icon: FlaskConical, prefetch: null }]
              : []),
            ...(showMessageQuality
              ? [
                  {
                    href: '/message-quality',
                    label: 'Review',
                    Icon: MessageSquareWarning,
                    prefetch: null,
                  },
                ]
              : []),
          ].map(({ href, label, Icon, prefetch }) => (
            <Link
              key={href}
              href={href}
              prefetch={prefetch}
              aria-current={pathname === href ? 'page' : undefined}
            >
              <Icon size={21} aria-hidden="true" />
              {label}
            </Link>
          ))}
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
