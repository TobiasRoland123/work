import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Status } from '@/db/types';
import { WeekOverview } from '@/components/week/WeekOverview';
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
  emoji: null,
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
  organisationRoles?: string[];
  week: { date: string; status: Status | null }[];
};

function renderAttendance(people: PersonInput[], userId = 'anna', pinnedIds: string[] = []) {
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
      pinnedIds,
      onPinChange: vi.fn(),
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
      /<div role="rowgroup"[^>]*aria-label="([^"]+)"[^>]*>([\s\S]*?)(?=<div role="rowgroup"[^>]*aria-label=|<\/main>)/g
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
      /<section class="day-panel-group day-panel-pins" aria-label="([^"]+)">([\s\S]*?)<\/section>/g
    ),
  ];
}

describe('attendance groups', () => {
  it('splits each exact resolved status into a counted group in canonical order', () => {
    const values = [
      ['leaving', 'LEAVING_EARLY', 'Leaving early'],
      ['client', 'AT_CLIENT', 'At client'],
      ['remote', 'REMOTE', 'Remote'],
      ['home', 'FROM_HOME', 'Home'],
      ['late', 'IN_LATE', 'In late'],
    ] as const;
    const { grid, sidebar } = renderAttendance(
      values.map(([userId, value]) => ({ userId, status: null, week: [daily(userId, value)] }))
    );

    const labels = gridGroups(grid).map((match) => match[1]);
    expect(labels).toEqual(['In late', 'Leaving early', 'Home', 'Remote', 'At client']);
    for (const [userId, , label] of values) {
      const group = gridGroup(grid, label);
      expect(group).toContain(`<h2>`);
      expect(group).toContain('aria-expanded="true"');
      expect(group).toContain(`${label} <span>1 shown</span>`);
      expect(group).toContain(`${userId[0].toUpperCase()}${userId.slice(1)} Person`);
      expect(sidebar).not.toContain(`${userId[0].toUpperCase()}${userId.slice(1)} Person`);
    }
    expect(gridGroups(grid)).toHaveLength(5);
    expect(sidebarGroups(sidebar).map((match) => match[1])).toEqual(['Pinned colleagues']);
    expect(sidebar).toContain('Pin the colleagues you work with most');
  });

  it('preserves directory order and pins the signed-in person first inside a group', () => {
    const { grid } = renderAttendance(
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
  });

  it('leaves colleagues out of the sidebar unless they are pinned', () => {
    const { grid, sidebar } = renderAttendance([
      { userId: 'zoe', week: [daily('zoe', 'IN_OFFICE')] },
      { userId: 'cara', week: [daily('cara', 'FROM_HOME')] },
      { userId: 'anna', week: [daily('anna', 'IN_OFFICE')] },
    ]);

    expect(sidebar).not.toContain('Zoe Person');
    expect(sidebar).not.toContain('Cara Person');
    expect(sidebar).toContain('Pinned <span>0</span>');
    expect(grid).toContain('Cara Person');
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
    expect(sidebarGroups(sidebar).map((match) => match[1])).toEqual(['Pinned colleagues']);
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
    expect(sidebar).not.toContain('Anna Person');
    expect(sidebar).not.toContain('Ben Person');
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
  });
});

describe('pinned colleagues in the sidebar', () => {
  const plain = (html: string) => html.replace(/<span aria-hidden="true">[^<]* <\/span>/gu, '');
  const people = (): PersonInput[] => [
    { userId: 'anna', week: [daily('anna', 'IN_OFFICE')] },
    { userId: 'ben', week: [daily('ben', 'FROM_HOME')] },
    {
      userId: 'cara',
      week: [
        {
          date: days[1],
          status: { ...makeStatus('cara', 'IN_LATE'), time: new Date('2026-09-22T08:00:00Z') },
        },
      ],
    },
    { userId: 'dan', week: [daily('dan', 'SICK')] },
    { userId: 'zoe', week: [daily('zoe', 'IN_OFFICE')], organisationRoles: ['Designer'] },
    { userId: 'eli', week: [daily('eli', 'IN_OFFICE')] },
  ];

  it('lists pinned colleagues with in-office people first, then by pin order', () => {
    const { sidebar } = renderAttendance(people(), 'anna', ['dan', 'ben', 'cara', 'zoe']);
    const text = plain(sidebar);

    expect(text).toContain('Pinned <span>4</span>');
    const order = ['Zoe', 'Cara', 'Ben', 'Dan'].map((name) => text.indexOf(`${name} Person`));
    expect(order.every((position) => position > -1)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(text).not.toContain('Eli Person');
    expect(text).toContain('<small>In office</small>');
    expect(text).toContain('<small>In late · from 10:00</small>');
    expect(text).toContain('<small>Home</small>');
    expect(text).toContain('<small>Sick</small>');
  });

  it('shows how many pinned colleagues are in and who is arriving later', () => {
    const { sidebar } = renderAttendance(people(), 'anna', ['zoe', 'cara', 'ben', 'dan']);
    expect(sidebar).toContain('1 of 4 in the office · 1 arriving later');
  });

  it('omits the arriving note when nobody is late', () => {
    const { sidebar } = renderAttendance(people(), 'anna', ['zoe', 'ben']);
    expect(sidebar).toContain('1 of 2 in the office');
    expect(sidebar).not.toContain('arriving later');
  });

  it('offers editing only once something is pinned', () => {
    const empty = renderAttendance(people(), 'anna', []).sidebar;
    const filled = renderAttendance(people(), 'anna', ['zoe']).sidebar;

    expect(empty).not.toContain('>Edit<');
    expect(empty).not.toContain('in the office ·');
    expect(filled).toContain('aria-pressed="false">Edit</button>');
    expect(filled).not.toContain('aria-label="Unpin');
    expect(filled).toContain('Add a colleague…');
  });

  it('ignores pins for people who are no longer in the directory or are the viewer', () => {
    const { sidebar } = renderAttendance(people(), 'anna', ['gone', 'anna', 'zoe']);

    expect(sidebar).toContain('Pinned <span>1</span>');
    expect(sidebar).toContain('Zoe Person');
    expect(sidebar).not.toContain('Anna Person');
  });

  it('shows the status on the selected day, not on other days', () => {
    const { sidebar } = renderAttendance(
      [
        { userId: 'anna', week: [daily('anna', 'IN_OFFICE')] },
        { userId: 'ben', week: [daily('ben', 'VACATION'), daily('ben', 'IN_OFFICE', days[2])] },
      ],
      'anna',
      ['ben']
    );

    expect(plain(sidebar)).toContain('<small>Vacation</small>');
    expect(sidebar).toContain('0 of 1 in the office');
  });

  it('keeps a colleague with no status on the day at the end', () => {
    const { sidebar } = renderAttendance(
      [
        { userId: 'anna', week: [daily('anna', 'IN_OFFICE')] },
        { userId: 'ben', week: [{ date: days[1], status: null }] },
        { userId: 'cara', week: [daily('cara', 'SICK')] },
      ],
      'anna',
      ['ben', 'cara']
    );
    const text = plain(sidebar);

    expect(text.indexOf('Cara Person')).toBeLessThan(text.indexOf('Ben Person'));
    expect(text).toContain('<small>No status</small>');
  });
});
