'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import './shell.css';

const links = [
  { href: '/today', label: 'Today', Icon: Home },
  { href: '/contact', label: 'Contact', Icon: Users },
  { href: '/profile', label: 'Profile', Icon: UserRound },
];

export function AppShell({
  children,
  firstName,
}: {
  children: ReactNode;
  firstName?: string | null;
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
          {links.map(({ href, label, Icon }) => (
            <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>
              <Icon size={21} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </div>
        <Link href="/profile" className="office-me">
          <span>{firstName?.[0] || 'W'}</span>
          <small>{firstName || 'My profile'}</small>
        </Link>
      </nav>
      <div className="app-shell-content">{children}</div>
    </div>
  );
}
