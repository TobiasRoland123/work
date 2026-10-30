import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Status } from '@/db/types';
import { WeekOverview } from '@/components/week/WeekOverview';
import { groupExceptions } from '@/components/week/presence';
import { workWeekDays } from '@/lib/status/week';

vi.mock('@/components/layout/PageHeader', () => ({ PageHeader: () => null }));
vi.mock('@/components/layout/StatusDialog', () => ({ StatusDialog: () => null }));
vi.mock('@/app/actions/statusActions', () => ({ deleteStatusByIdAction: vi.fn() }));
vi.mock('@/components/week/week.css', () => ({}));

beforeEach(() => vi.stubGlobal('React', React));
afterEach(() => vi.unstubAllGlobals());

const days = workWeekDays('2026-09-21');
const makeStatus = (userID: string, value: Status['status'], date = days[1]): Status => ({
  id: 1,
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
  createdAt: '2026-09-19T07:00:00Z',
  announcedAt: new Date('2026-09-19T07:00:00Z'),
  sourceMessageKey: null,
});

type PersonInput = {
  userId: string;
  status?: Status | null;
  week: { date: string; status: Status | null }[];
};

function renderAttendance(people: PersonInput[], userId = 'anna') {
  const html = renderToStaticMarkup(
    React.createElement(WeekOverview, {
      profiles: people.map((person) => ({
        email: `${person.userId}@example.com`,
        firstName: person.userId[0].toUpperCase() + person.userId.slice(1),
        lastName: 'Person',
        ...person,
      })),
      userId,
      days,
      today: days[1],
      weekStart: days[0],
      currentWeekStart: days[0],
      arrival: null,
      syncError: false,
      plans: [],
      onStatusSaved: vi.fn(),
    })
  );
  return {
    html,
    grid: html.match(/<div class="week-board"[\s\S]*?<\/main>/)?.[0] ?? '',
    sidebar: html.match(/<aside[\s\S]*?<\/aside>/)?.[0] ?? '',
  };
}

function daily(userId: string, value: Status['status'], date = days[1]) {
  return { date, status: makeStatus(userId, value, date) };
}

function note(userId: string, details: string) {
  return { date: days[1], status: { ...makeStatus(userId, null), details } };
}

function gridGroups(grid: string) {
  return [
    ...grid.matchAll(
      /<div role="rowgroup"[^>]*aria-label="([^"]+)"[^>]*>([\s\S]*?)(?=<div role="rowgroup"[^>]*aria-label=|<section class="week-list"|<ul class="week-legend"|<\/main>)/g
    ),
  ];
}

function gridGroup(grid: string, label: string) {
  const group = gridGroups(grid).find((match) => match[1] === label);
  expect(group, `expected a grid group labeled ${label}`).toBeDefined();
  return group?.[2] ?? '';
}

function sidebarGroups(sidebar: string) {
  return [
    ...sidebar.matchAll(
      /<section class="day-panel-group" aria-label="([^"]+)">([\s\S]*?)<\/section>/g
    ),
  ];
}

describe('attendance groups', () => {
  it('splits each exact resolved status into a counted group in canonical order', () => {
    const values = [
      ['leaving', 'LEAVING_EARLY', 'Leaving early'],
      ['client', 'AT_CLIENT', 'At client'],
      ['home', 'FROM_HOME', 'Home'],
      ['late', 'IN_LATE', 'In late'],
    ] as const;
    const { grid, sidebar } = renderAttendance(
      values.map(([userId, value]) => ({ userId, status: null, week: [daily(userId, value)] }))
    );

    const labels = gridGroups(grid).map((match) => match[1]);
    expect(labels).toEqual(['In late', 'Leaving early', 'Home', 'At client']);
    for (const [userId, , label] of values) {
      const group = gridGroup(grid, label);
      expect(group).toContain(`<h2>`);
      expect(group).toContain('aria-expanded="true"');
      expect(group).toContain(`${label} <span>1 shown</span>`);
      expect(group).toContain(`${userId[0].toUpperCase()}${userId.slice(1)} Person`);
      const sidebarGroup = sidebarGroups(sidebar).find((match) => match[1] === label)?.[2] ?? '';
      expect(sidebarGroup).toContain('aria-expanded="true"');
      expect(sidebarGroup).toContain(`${label} <span>1</span></button></h3>`);
      expect(sidebarGroup).toContain(`${userId[0].toUpperCase()}${userId.slice(1)} Person`);
    }
    expect(gridGroups(grid)).toHaveLength(4);
    expect(sidebarGroups(sidebar)).toHaveLength(4);
  });

  it('preserves directory order and pins the signed-in person first inside a group', () => {
    const { grid, sidebar } = renderAttendance(
      ['zoe', 'ben', 'anna', 'cara'].map((userId) => ({
        userId,
        status: null,
        week: [daily(userId, 'FROM_HOME')],
      }))
    );
    const home = gridGroup(grid, 'Home');
    expect(home).toContain('Home <span>4 shown</span>');
    expect(home.indexOf('Anna Person')).toBeLessThan(home.indexOf('Zoe Person'));
    expect(home.indexOf('Zoe Person')).toBeLessThan(home.indexOf('Ben Person'));
    expect(home.indexOf('Ben Person')).toBeLessThan(home.indexOf('Cara Person'));
    for (const name of ['Anna', 'Zoe', 'Ben', 'Cara']) {
      expect(home.match(new RegExp(`${name} Person`, 'g'))).toHaveLength(1);
    }
    const sidebarHome = sidebarGroups(sidebar).find((match) => match[1] === 'Home')?.[2] ?? '';
    expect(sidebarHome).toContain('Home <span>4</span>');
    for (const name of ['Anna', 'Zoe', 'Ben', 'Cara']) {
      expect(sidebarHome.match(new RegExp(`${name} Person`, 'g'))).toHaveLength(1);
    }
  });

  it('keeps Note distinct from No status and omits empty groups', () => {
    const { grid, sidebar } = renderAttendance([
      { userId: 'note', status: null, week: [note('note', 'Workshop')] },
      {
        userId: 'missing',
        status: null,
        week: [{ date: days[1], status: null }, daily('missing', 'VACATION', days[2])],
      },
    ]);
    expect(grid).toContain('aria-label="Note"');
    expect(grid).toContain('aria-label="No status"');
    expect(grid).not.toContain('aria-label="Home"');
    expect(sidebar).toContain('aria-label="Note"');
    expect(sidebar).not.toContain('aria-label="No status"');
    expect(sidebar).not.toContain('aria-label="Home"');
    expect(grid).toContain('Note <span>1 shown</span>');
    expect(grid).toContain('No status <span>1 shown</span>');
  });

  it('groups by the selected day status, not profile status or another day', () => {
    const { grid, sidebar } = renderAttendance([
      {
        userId: 'anna',
        status: makeStatus('anna', 'SICK'),
        week: [daily('anna', 'FROM_HOME')],
      },
      {
        userId: 'ben',
        status: makeStatus('ben', 'FROM_HOME'),
        week: [daily('ben', 'SICK')],
      },
    ]);
    expect(gridGroup(grid, 'Home')).toContain('Anna Person');
    expect(gridGroup(grid, 'Home')).not.toContain('Ben Person');
    expect(gridGroup(grid, 'Sick')).toContain('Ben Person');
    expect(gridGroup(grid, 'Sick')).not.toContain('Anna Person');
    expect(sidebar).toContain('aria-label="Home"');
    expect(sidebar).toContain('aria-label="Sick"');
  });

  it('keeps week-wide exceptions visible in the selected-day In office or No status group', () => {
    const { html, grid, sidebar } = renderAttendance([
      {
        userId: 'office',
        status: null,
        week: [
          { date: days[1], status: makeStatus('office', 'IN_OFFICE') },
          daily('office', 'VACATION', days[2]),
        ],
      },
      {
        userId: 'unknown',
        status: null,
        week: [{ date: days[1], status: null }, daily('unknown', 'ON_LEAVE', days[2])],
      },
      {
        userId: 'alloffice',
        status: null,
        week: days.map((date) => daily('alloffice', 'IN_OFFICE', date)),
      },
    ]);
    expect(gridGroup(grid, 'In office')).toContain('Office Person');
    expect(gridGroup(grid, 'In office')).toContain('In office <span>1 shown</span>');
    expect(grid).not.toContain('Alloffice Person');
    expect(html).toContain('Grouped by Tuesday 22 September.');
    expect(html).toContain('Showing colleagues with an attendance exception this week.');
    expect(grid).toContain('aria-describedby="week-grouping-note"');
    expect(sidebar).toContain('<strong>2</strong> of 3 in the office');
    expect(gridGroup(grid, 'No status')).toContain('Unknown Person');
    expect(sidebar).not.toContain('Office Person');
    expect(sidebar).not.toContain('Unknown Person');
    expect(sidebar).not.toContain('aria-label="In office"');
    expect(sidebar).not.toContain('aria-label="No status"');
  });
});

describe('phone day list', () => {
  it('files late arrivals and early departures under Partly in, apart from the other exceptions', () => {
    const people = [
      ['late', 'IN_LATE'],
      ['sick', 'SICK'],
      ['home', 'FROM_HOME'],
      ['early', 'LEAVING_EARLY'],
      ['vacation', 'VACATION'],
      ['client', 'AT_CLIENT'],
      ['office', 'IN_OFFICE'],
    ].map(([userId, value]) => ({
      userId,
      email: `${userId}@example.com`,
      week: [daily(userId, value as Status['status'])],
    }));
    const noted = {
      userId: 'noted',
      email: 'noted@example.com',
      week: [note('noted', 'Workshop')],
    };
    const { groups, other, inOffice } = groupExceptions([...people, noted], days[1]);
    expect(groups.map(({ key, members }) => [key, members.map((person) => person.userId)])).toEqual(
      [
        ['out', ['sick', 'vacation']],
        ['elsewhere', ['home', 'client']],
        ['partly', ['late', 'early']],
      ]
    );
    expect(inOffice.map((person) => person.userId)).toEqual(['office']);
    expect(other.map((person) => person.userId)).toEqual(['noted']);
  });

  it('counts the selected day per filter and moves the signed-in person to Your week', () => {
    const { html } = renderAttendance([
      { userId: 'anna', status: null, week: [daily('anna', 'FROM_HOME')] },
      { userId: 'ben', status: null, week: [daily('ben', 'SICK')] },
      { userId: 'cara', status: null, week: [daily('cara', 'IN_LATE')] },
      { userId: 'dan', status: null, week: [daily('dan', 'AT_CLIENT')] },
      {
        userId: 'eve',
        status: null,
        week: [daily('eve', 'IN_OFFICE'), daily('eve', 'VACATION', days[3])],
      },
    ]);
    const list =
      html.match(/<section class="week-list"[\s\S]*?(?=<ul class="week-legend")/)?.[0] ?? '';
    const pills = [
      ...list.matchAll(
        /aria-pressed="(?:true|false)">(?:<i[^>]*><\/i>)?([^<]+) <span>(\d+)<\/span>/g
      ),
    ];
    expect(pills.map(([, label, count]) => [label, Number(count)])).toEqual([
      ['All', 3],
      ['Out', 1],
      ['Elsewhere', 1],
      ['Partly in', 1],
    ]);
    expect(list).toContain('Your week');
    expect(list).not.toContain('Anna Person');
    expect(list).toContain('aria-label="In office Tuesday, away other days"');
    expect(list).toContain('Next: Thursday · Vacation');
  });
});
