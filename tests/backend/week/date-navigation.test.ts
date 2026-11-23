import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DayPresence, Status, UserWithExtras } from '@/db/types';
import { WeekOverview } from '@/components/week/WeekOverview';
import { workWeekDays, workWeekStart } from '@/lib/status/week';

vi.mock('@/components/layout/PageHeader', () => ({
  PageHeader: ({
    title,
    subtitle,
    actions,
  }: {
    title: string;
    subtitle: string;
    actions?: React.ReactNode;
  }) =>
    React.createElement(
      'header',
      null,
      React.createElement('h1', null, title),
      React.createElement('p', null, subtitle),
      actions
    ),
}));
vi.mock('@/components/layout/StatusDialog', () => ({ StatusDialog: () => null }));
vi.mock('@/app/actions/statusActions', () => ({ deleteStatusByIdAction: vi.fn() }));
vi.mock('@/components/week/week.css', () => ({}));

beforeEach(() => vi.stubGlobal('React', React));
afterEach(() => vi.unstubAllGlobals());

const today = '2026-10-14';
const status = (userID: string, date: string, value: Status['status']): Status => ({
  id: date === today ? 1 : 2,
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
  createdAt: `${date}T08:00:00Z`,
  announcedAt: new Date(`${date}T08:00:00Z`),
  sourceMessageKey: null,
});

function person(
  userId: string,
  firstName: string,
  dates: string[],
  officeDays: string[]
): UserWithExtras {
  const week: DayPresence[] = dates.map((date) => ({
    date,
    status: status(userId, date, officeDays.includes(date) ? 'IN_OFFICE' : 'FROM_HOME'),
  }));
  return {
    userId,
    email: `${userId}@example.com`,
    firstName,
    lastName: 'Colleague',
    status: null,
    week,
  };
}

function render(days: string[], selectedDate = days[0], pinnedIds: string[] = []) {
  const allDates = [...new Set([...days, today])];
  const profiles = [
    person('anna', 'Anna', allDates, [today]),
    person('ben', 'Ben', allDates, [today, selectedDate]),
  ];
  return renderToStaticMarkup(
    React.createElement(WeekOverview, {
      profiles,
      userId: 'anna',
      days,
      today,
      weekStart: workWeekStart(selectedDate),
      currentWeekStart: workWeekStart(today),
      arrival: null,
      syncError: false,
      plans: [],
      pinnedIds,
      onPinChange: vi.fn(),
      onStatusSaved: vi.fn(),
    })
  );
}

const navigationOf = (html: string) =>
  html.match(/<nav class="week-nav"[\s\S]*?<\/nav>/)?.[0] ?? '';
const viewLinksOf = (html: string) =>
  html.match(/<div class="week-filters"[\s\S]*?<\/div>/)?.[0] ?? '';

describe('date navigation in WeekOverview', () => {
  it('moves the reported Wednesday 14 October back to Tuesday 13 October and forward to Thursday', () => {
    const html = render([today]);
    expect(html).toContain('aria-label="Previous day" href="/today?day=2026-10-13"');
    expect(html).toContain('aria-label="Next day" href="/today?day=2026-10-15"');
    expect(navigationOf(html)).not.toContain('/today?week=');
  });

  it('uses selected-day routes and labels for previous, today, and next', () => {
    const html = render(['2026-10-13']);
    expect(html).toContain('aria-label="Choose day"');
    expect(navigationOf(html)).toContain('aria-label="Choose date"');
    expect(html).toMatch(/<a aria-label="Previous day" href="\/today\?day=2026-10-12"/);
    expect(html).toContain('href="/today"');
    expect(html).toMatch(/<a aria-label="Next day" href="\/today\?day=2026-10-14"/);
    expect(navigationOf(html)).not.toContain('aria-current="page"');
    expect(viewLinksOf(html)).toContain(
      'aria-current="page" href="/today?day=2026-10-13">Today</a>'
    );
    expect(viewLinksOf(html)).toContain('href="/today?week=2026-10-12">Week</a>');
  });

  it.each([
    ['2026-10-23', '2026-10-22', '2026-10-26'], // Friday
    ['2026-10-24', '2026-10-23', '2026-10-26'], // Saturday
    ['2026-10-25', '2026-10-23', '2026-10-26'], // Sunday and DST transition
    ['2026-10-26', '2026-10-23', '2026-10-27'], // Monday
    ['2026-09-01', '2026-08-31', '2026-09-02'], // Month boundary
    ['2026-10-30', '2026-10-29', '2026-11-02'], // Weekend across a month boundary
    ['2027-01-01', '2026-12-31', '2027-01-04'], // Year boundary
    ['2021-12-31', '2021-12-30', '2022-01-03'], // Weekend across a year boundary
  ])('navigates to the nearest weekdays around %s', (date, previous, next) => {
    const html = render([date]);
    expect(html).toMatch(
      new RegExp(`<a aria-label="Previous day" href="/today\\?day=${previous}"`)
    );
    expect(html).toMatch(new RegExp(`<a aria-label="Next day" href="/today\\?day=${next}"`));
  });

  it.each([
    ['2026-10-16', ['2026-10-19', '2026-10-20', '2026-10-21']],
    ['2026-12-30', ['2026-12-31', '2027-01-01', '2027-01-04']],
  ])('keeps single-day mode through repeated navigation from %s', (start, sequence) => {
    let day = start;
    for (const expected of sequence) {
      const html = render([day]);
      const href = html.match(/aria-label="Next day" href="([^"]+)"/)?.[1];
      const url = new URL(href ?? '', 'http://localhost');
      expect(url.searchParams.get('day')).toBe(expected);
      expect(url.searchParams.has('week')).toBe(false);
      day = url.searchParams.get('day')!;
    }
  });

  it('uses the selected historical date for the title, subtitle, grid, counts, and panel', () => {
    const html = render(['2026-10-13'], '2026-10-13', ['ben']);
    expect(html).toContain('<h1>Tuesday</h1>');
    expect(html).toContain('Tuesday, 13 October 2026');
    expect(viewLinksOf(html)).toContain(
      'aria-current="page" href="/today?day=2026-10-13">Today</a>'
    );
    expect(html).not.toContain('<em>Today</em>');
    expect(html).toContain('<strong>1</strong> out of office');
    expect(html).toContain('<strong>1</strong> of 2 in the office');
    expect(html).toContain('Who is in the office on Tuesday');
    expect(html).toContain('Earlier');
    expect(html).toContain('Anna Colleague');
    expect(html).toContain('<strong><span aria-hidden="true">🏠 </span>Home</strong>');
    expect(html).toContain('<span>Ben Colleague</span>');
    expect(html).not.toContain('<span>Anna Colleague</span>');
  });

  it('keeps week navigation at seven days and the Today link at /today', () => {
    const days = workWeekDays('2026-10-12');
    const html = render(days);
    expect(html).toContain('aria-label="Choose week"');
    expect(navigationOf(html)).not.toContain('aria-label="Choose date"');
    expect(navigationOf(html)).toContain('aria-label="Choose week" title="Choose week"');
    expect(html).toContain('aria-label="Previous week" href="/today?week=2026-10-05"');
    expect(html).toContain('aria-label="Next week" href="/today?week=2026-10-19"');
    expect(html).toContain('href="/today"');
    expect(navigationOf(html)).not.toContain('aria-current="page"');
    expect(viewLinksOf(html)).toContain(
      'aria-current="page" href="/today?week=2026-10-12">Week</a>'
    );
  });

  it('marks Today only when the single displayed date is the actual current date', () => {
    const html = render([today]);
    expect(html).toContain('<h1>Today</h1>');
    expect(navigationOf(html)).toContain('aria-current="page"');
    expect(html).toContain('<em>Today</em>');
  });

  it('keeps the viewed week or date when switching between Today and Week views', () => {
    const otherDayHtml = render(['2026-10-21']);
    expect(viewLinksOf(otherDayHtml)).toContain(
      'aria-current="page" href="/today?day=2026-10-21">Today</a>'
    );
    expect(viewLinksOf(otherDayHtml)).toContain('href="/today?week=2026-10-19">Week</a>');

    const otherWeekHtml = render(workWeekDays('2026-10-19'));
    expect(viewLinksOf(otherWeekHtml)).toContain('href="/today?day=2026-10-19">Today</a>');
    expect(viewLinksOf(otherWeekHtml)).toContain(
      'aria-current="page" href="/today?week=2026-10-19">Week</a>'
    );
    expect(navigationOf(otherWeekHtml)).toContain('href="/today"');
  });
});
