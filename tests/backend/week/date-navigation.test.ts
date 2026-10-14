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

function render(days: string[], selectedDate = days[0]) {
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
      onStatusSaved: vi.fn(),
    })
  );
}

describe('date navigation in WeekOverview', () => {
  it('moves the reported Wednesday 14 October back to Tuesday 13 October and forward to Thursday', () => {
    const html = render([today]);
    expect(html).toContain('aria-label="Previous day" href="/today?day=2026-10-13"');
    expect(html).toContain('aria-label="Next day" href="/today?day=2026-10-15"');
    expect(html).not.toContain('/today?week=');
  });

  it('uses selected-day routes and labels for previous, today, and next', () => {
    const html = render(['2026-10-13']);
    expect(html).toContain('aria-label="Choose day"');
    expect(html).toMatch(/<a aria-label="Previous day" href="\/today\?day=2026-10-12"/);
    expect(html).toContain('href="/today"');
    expect(html).toMatch(/<a aria-label="Next day" href="\/today\?day=2026-10-14"/);
    expect(html).not.toContain('aria-current="page"');
  });

  it.each([
    ['2026-01-01', '2025-12-31', '2026-01-02'],
    ['2026-03-01', '2026-02-28', '2026-03-02'],
    ['2026-10-25', '2026-10-24', '2026-10-26'], // DST transition weekend
    ['2027-01-01', '2026-12-31', '2027-01-02'],
  ])('navigates one calendar day around %s', (date, previous, next) => {
    const html = render([date]);
    expect(html).toMatch(
      new RegExp(`<a aria-label="Previous day" href="/today\\?day=${previous}"`)
    );
    expect(html).toMatch(new RegExp(`<a aria-label="Next day" href="/today\\?day=${next}"`));
  });

  it.each([
    ['2026-10-16', ['2026-10-17', '2026-10-18', '2026-10-19']],
    ['2026-12-30', ['2026-12-31', '2027-01-01', '2027-01-02']],
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

  it('uses the selected historical date for the title, subtitle, grid, filter, counts, and panel', () => {
    const html = render(['2026-10-13']);
    expect(html).toContain('<h1>Tuesday</h1>');
    expect(html).toContain('Tuesday, 13 October 2026');
    expect(html).toContain('Exceptions Tue');
    expect(html).not.toContain('Exceptions today');
    expect(html).not.toContain('<em>Today</em>');
    expect(html).toContain('<strong>1</strong> in office');
    expect(html).toContain('<strong>1</strong> of 2 in the office');
    expect(html).toContain('Who is where on Tuesday');
    expect(html).toContain('Earlier');
    expect(html).toContain('Anna Colleague');
    expect(html).toContain('<strong>Home</strong>');
    expect(html).not.toContain('<span>Ben Colleague</span>');
  });

  it('keeps week navigation at seven days and the Today link at /today', () => {
    const days = workWeekDays('2026-10-12');
    const html = render(days);
    expect(html).toContain('aria-label="Choose week"');
    expect(html).toContain('aria-label="Previous week" href="/today?week=2026-10-05"');
    expect(html).toContain('aria-label="Next week" href="/today?week=2026-10-19"');
    expect(html).toContain('href="/today"');
    expect(html).not.toContain('aria-current="page"');
  });

  it('marks Today only when the single displayed date is the actual current date', () => {
    const html = render([today]);
    expect(html).toContain('<h1>Today</h1>');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('Exceptions today');
    expect(html).toContain('<em>Today</em>');
  });
});
