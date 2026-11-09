import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Status, UserWithExtras } from '@/db/types';
import { WeekOverview } from '@/components/week/WeekOverview';
import { announcedSince } from '@/components/week/presence';
import { workWeekDays } from '@/lib/status/week';
import {
  WEEK_LAYOUT_COOKIE,
  rememberWeekLayout,
  weekLayout,
  type WeekLayout,
} from '@/components/week/layoutPreference';

vi.mock('@/components/layout/PageHeader', () => ({ PageHeader: () => null }));
vi.mock('@/components/layout/StatusDialog', () => ({ StatusDialog: () => null }));
vi.mock('@/app/actions/statusActions', () => ({ deleteStatusByIdAction: vi.fn() }));
vi.mock('@/components/week/week.css', () => ({}));

beforeEach(() => vi.stubGlobal('React', React));
afterEach(() => vi.unstubAllGlobals());

const days = workWeekDays('2026-09-21');
const lastLook = Date.parse('2026-09-22T06:00:00Z');

const declaration = (
  userID: string,
  value: Status['status'],
  announcedAt: string,
  date = days[1]
): Status => ({
  id: 1,
  userID,
  status: value,
  emoji: null,
  details: null,
  time: null,
  fromDate: date,
  toDate: date,
  startsAt: null,
  endsAt: null,
  startsAtApproximate: false,
  endsAtApproximate: false,
  createdAt: announcedAt,
  announcedAt: new Date(announcedAt),
  sourceMessageKey: null,
});

const person = (userId: string, statuses: Status[]): UserWithExtras => ({
  userId,
  email: `${userId}@example.com`,
  firstName: userId[0].toUpperCase() + userId.slice(1),
  lastName: 'Person',
  week: statuses.map((status) => ({ date: status.fromDate!, status })),
});

function render(
  profiles: UserWithExtras[],
  seenSince: number | null,
  initialLayout: WeekLayout = 'grouped'
) {
  const html = renderToStaticMarkup(
    React.createElement(WeekOverview, {
      profiles,
      userId: 'anna',
      days,
      today: days[1],
      weekStart: days[0],
      currentWeekStart: days[0],
      arrival: null,
      syncError: false,
      plans: [],
      pinnedIds: [],
      onPinChange: vi.fn(),
      onStatusSaved: vi.fn(),
      seenSince,
      onMarkSeen: vi.fn(),
      initialLayout,
    })
  );
  const groups = [
    ...html.matchAll(
      /<div role="rowgroup"[^>]*aria-label="([^"]+)"[^>]*>([\s\S]*?)(?=<div role="rowgroup"[^>]*aria-label=|<\/main>)/g
    ),
  ];
  return {
    html,
    labels: groups.map((match) => match[1]),
    group: (label: string) => groups.find((match) => match[1] === label)?.[2] ?? '',
  };
}

describe('announcedSince', () => {
  it('returns the newest exception announced after the last look on the given days', () => {
    const ben = person('ben', [
      declaration('ben', 'FROM_HOME', '2026-09-21T07:00:00Z', days[0]),
      declaration('ben', 'SICK', '2026-09-22T07:30:00Z', days[1]),
      declaration('ben', 'REMOTE', '2026-09-22T08:15:00Z', days[2]),
    ]);
    expect(announcedSince(ben, days, lastLook)).toBe(Date.parse('2026-09-22T08:15:00Z'));
    expect(announcedSince(ben, days.slice(0, 2), lastLook)).toBe(
      Date.parse('2026-09-22T07:30:00Z')
    );
    expect(announcedSince(ben, days.slice(0, 1), lastLook)).toBeNull();
  });

  it('treats the last-look boundary as seen and reads retained daily announcements after arrival', () => {
    const visible = declaration('ben', 'IN_LATE', '2026-09-22T07:30:00Z');
    const ben = person('ben', []);
    ben.week = [
      { date: days[1], status: { ...visible, status: 'IN_OFFICE' }, announcement: visible },
    ];
    const at = Date.parse('2026-09-22T07:30:00Z');
    expect(announcedSince(ben, [days[1]], at)).toBeNull();
    expect(announcedSince(ben, [days[1]], at - 1)).toBe(at);
  });

  it('ignores in-office declarations and Workday Defaults', () => {
    const ben = person('ben', [
      declaration('ben', 'IN_OFFICE', '2026-09-22T07:30:00Z', days[1]),
      { ...declaration('ben', 'IN_OFFICE', '2026-09-22T07:00:00Z', days[2]), id: 0 },
    ]);
    expect(announcedSince(ben, days, lastLook)).toBeNull();
  });
});

describe('new since you last looked', () => {
  const profiles = [
    person('anna', [declaration('anna', 'FROM_HOME', '2026-09-22T09:00:00Z')]),
    person('ben', [declaration('ben', 'SICK', '2026-09-22T07:30:00Z')]),
    person('cara', [declaration('cara', 'REMOTE', '2026-09-21T15:00:00Z')]),
    person('dan', [declaration('dan', 'AWAY', '2026-09-22T08:45:00Z')]),
  ];

  it('leads the board with colleagues announced since, newest first, and keeps their groups', () => {
    const { labels, group } = render(profiles, lastLook);
    expect(labels).toEqual(['New since you last looked', 'Home', 'Remote', 'Sick', 'Away']);
    const fresh = group('New since you last looked');
    expect(fresh).toContain('2 shown');
    expect(fresh).toContain('Mark as seen');
    expect(fresh).not.toContain('Anna Person');
    expect(fresh).not.toContain('Cara Person');
    expect(fresh.indexOf('Dan Person')).toBeLessThan(fresh.indexOf('Ben Person'));
    expect(fresh).toContain('Announced 10:45');
    expect(group('Sick')).toContain('Ben Person');
  });

  it('shows no new group before the last look is known or when nothing is newer', () => {
    expect(render(profiles, null).labels).not.toContain('New since you last looked');
    expect(render(profiles, Date.parse('2026-09-22T12:00:00Z')).labels).not.toContain(
      'New since you last looked'
    );
  });
});

describe('chronological layout', () => {
  const profiles = [
    person('anna', [declaration('anna', 'FROM_HOME', '2026-09-22T09:00:00Z')]),
    person('ben', [declaration('ben', 'SICK', '2026-09-22T07:30:00Z')]),
    person('cara', [declaration('cara', 'REMOTE', '2026-09-21T15:00:00Z')]),
    person('dan', [declaration('dan', 'AWAY', '2026-09-22T08:45:00Z')]),
    person('eve', [declaration('eve', 'VACATION', '2026-09-20T10:00:00Z')]),
  ];
  const order = (section: string) =>
    [...section.matchAll(/week-person-name-text">([^<]+)</g)].map((match) => match[1]);

  it('lists everyone newest first, with what is new since the last look on top', () => {
    const { html, labels, group } = render(profiles, lastLook, 'chronological');
    expect(labels).toEqual(['New since you last looked', 'Earlier']);
    expect(order(group('New since you last looked'))).toEqual(['Dan Person', 'Ben Person']);
    // The signed-in person's own announcement is never news, but still sorts by time.
    expect(order(group('Earlier'))).toEqual(['Anna Person', 'Cara Person', 'Eve Person']);
    expect(group('Earlier')).toContain('Announced Mon 21 Sept, 17:00');
    expect(html).toMatch(/aria-pressed="true"[^>]*>.*?By time/);
  });

  it('is one newest-first list when nothing is new', () => {
    const { labels, group } = render(profiles, null, 'chronological');
    expect(labels).toEqual(['Newest first']);
    expect(order(group('Newest first'))).toEqual([
      'Anna Person',
      'Dan Person',
      'Ben Person',
      'Cara Person',
      'Eve Person',
    ]);
  });

  it('defaults to grouped and remembers the choice in a cookie', () => {
    expect(weekLayout(undefined)).toBe('grouped');
    expect(weekLayout('garbage')).toBe('grouped');
    expect(weekLayout('chronological')).toBe('chronological');
    expect(render(profiles, null).html).toMatch(/aria-pressed="true"[^>]*>.*?By status/);

    const document = { cookie: '' };
    vi.stubGlobal('document', document);
    rememberWeekLayout('chronological');
    expect(document.cookie).toBe(
      `${WEEK_LAYOUT_COOKIE}=chronological; path=/; max-age=31536000; samesite=lax`
    );
  });
});
