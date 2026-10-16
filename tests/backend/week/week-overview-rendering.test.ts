import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DayPresence, Status } from '@/db/types';
import { WeekOverview } from '@/components/week/WeekOverview';
import { ProfileListItem } from '@/components/ui/ProfileListItem/ProfileListItem';
import { resolveWorkWeek, workWeekDays } from '@/lib/status/week';

vi.mock('@/components/layout/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => React.createElement('h1', null, title),
}));
vi.mock('@/components/layout/StatusDialog', () => ({ StatusDialog: () => null }));
vi.mock('@/app/actions/statusActions', () => ({ deleteStatusByIdAction: vi.fn() }));
vi.mock('@/components/week/week.css', () => ({}));

// The backend test project compiles JSX in classic mode; Next compiles the actual UI.
beforeEach(() => vi.stubGlobal('React', React));
afterEach(() => vi.unstubAllGlobals());

const days = workWeekDays('2026-09-21');
const status = (values: Partial<Status>): Status => ({
  id: 7,
  userID: 'anna',
  status: 'IN_OFFICE',
  details: null,
  time: null,
  fromDate: days[0],
  toDate: days[4],
  startsAt: null,
  endsAt: null,
  startsAtApproximate: false,
  endsAtApproximate: false,
  createdAt: '2026-09-19T07:00:00Z',
  announcedAt: new Date('2026-09-19T07:00:00Z'),
  sourceMessageKey: null,
  origin: null,
  ...values,
});

function renderWeek(selectedStatus: Status | null) {
  const html = renderToStaticMarkup(
    React.createElement(WeekOverview, {
      profiles: [
        {
          userId: 'anna',
          email: 'anna@example.com',
          firstName: 'Anna',
          lastName: 'Attendee',
          status: status({ status: 'VACATION' }),
          week: days.map((date) => ({ date, status: selectedStatus })),
        },
      ],
      userId: 'anna',
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

function renderToday(
  selectedStatus: Status | null,
  profileStatus: Status | null = null,
  profileWeek?: DayPresence[]
) {
  const today = days[1];
  const html = renderToStaticMarkup(
    React.createElement(WeekOverview, {
      profiles: [
        {
          userId: 'anna',
          email: 'anna@example.com',
          firstName: 'Anna',
          lastName: 'Attendee',
          status: profileStatus,
          week: profileWeek ?? [{ date: today, status: selectedStatus }],
        },
      ],
      userId: 'anna',
      days: [today],
      today,
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

describe('status labels in the week grid and selected-day sidebar', () => {
  it.each([
    ['IN_LATE', 'In late'],
    ['LEAVING_EARLY', 'Leaving early'],
    ['FROM_HOME', 'Home'],
    ['AT_CLIENT', 'At client'],
    ['SICK', 'Sick'],
    ['CHILD_SICK', 'Child sick'],
    ['VACATION', 'Vacation'],
    ['ON_LEAVE', 'On leave'],
    ['AWAY', 'Away'],
  ] as const)('displays %s in both areas', (value, label) => {
    const { grid, sidebar } = renderWeek(status({ status: value }));
    expect(grid).toContain(`<strong>${label}</strong>`);
    expect(sidebar).toContain(`<small class="day-panel-detail"><span>${label}</span></small>`);
  });

  it.each([0, 7])('omits office attendance with id %s from both areas', (id) => {
    const { grid, sidebar } = renderWeek(status({ id }));
    expect(grid).not.toContain('Anna Attendee');
    expect(sidebar).not.toContain('Anna Attendee');
  });

  it('omits colleagues with no resolved status from both areas', () => {
    const { grid, sidebar } = renderWeek(null);
    expect(grid).not.toContain('Anna Attendee');
    expect(sidebar).not.toContain('Anna Attendee');
  });

  it.each(['IN_LATE', 'LEAVING_EARLY'] as const)(
    'retains the %s label alongside its arrival time and details',
    (value) => {
      const { grid, sidebar } = renderWeek(
        status({ status: value, time: new Date('2026-09-22T08:30:00Z'), details: 'dentist' })
      );
      const label = value === 'IN_LATE' ? 'In late' : 'Leaving early';
      const note = value === 'IN_LATE' ? 'from 10:30' : 'until 10:30';
      expect(grid).toContain(`<strong>${label}</strong></span><small>${note} · dentist</small>`);
      expect(sidebar).toContain(
        `<small class="day-panel-detail"><span>${label} · ${note} · dentist</span></small>`
      );
    }
  );

  it('leaves office cells blank while preserving the planning button', () => {
    const mixedWeek = days.map((date, index) => ({
      date,
      status: status({
        status: index === 2 ? 'IN_OFFICE' : 'VACATION',
        fromDate: date,
        toDate: date,
      }),
    }));
    const html = renderToStaticMarkup(
      React.createElement(WeekOverview, {
        profiles: [
          {
            userId: 'anna',
            email: 'anna@example.com',
            firstName: 'Anna',
            lastName: 'Attendee',
            status: null,
            week: mixedWeek,
          },
        ],
        userId: 'anna',
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
    const grid = html.match(/<div class="week-board"[\s\S]*?<\/main>/)?.[0] ?? '';
    expect(grid).toContain('<span class="sr-only">No exception</span>');
    expect(grid).not.toContain('<strong>In office</strong>');
    expect(grid).toMatch(/aria-label="Plan [^"]+\. Currently: No exception"/);
  });

  it('groups late arrivals and early departures separately', () => {
    const late = renderWeek(status({ status: 'IN_LATE' }));
    expect(late.sidebar).toContain('aria-label="In late"');
    expect(late.sidebar).not.toContain('aria-label="Leaving early"');

    const early = renderWeek(status({ status: 'LEAVING_EARLY' }));
    expect(early.sidebar).toContain('aria-label="Leaving early"');
    expect(early.sidebar).not.toContain('aria-label="In late"');
  });

  it('retains description-only announcements in both areas', () => {
    const { grid, sidebar } = renderWeek(status({ status: null, details: 'At a workshop' }));
    expect(grid).toContain('<strong>Note</strong></span><small>At a workshop</small>');
    expect(sidebar).toContain(
      '<small class="day-panel-detail"><span>Note · At a workshop</span></small>'
    );
  });
});

describe('attendance view links', () => {
  it('offers only Today and Week and marks the current mode', () => {
    const { html: weekHtml } = renderWeek(status({ status: 'VACATION' }));
    const weekLinks = weekHtml.match(/<div class="week-filters"[\s\S]*?<\/div>/)?.[0] ?? '';
    expect(weekLinks).toContain('aria-label="Attendance view"');
    expect(weekLinks.match(/<a /g)).toHaveLength(2);
    expect(weekLinks).toContain('href="/today">Today</a>');
    expect(weekLinks).toContain(`aria-current="page" href="/today?week=${days[0]}">Week</a>`);
    expect(weekLinks).not.toMatch(/Everyone|In office|Exceptions/);

    const { html: todayHtml } = renderToday(status({ status: 'VACATION' }));
    const todayLinks = todayHtml.match(/<div class="week-filters"[\s\S]*?<\/div>/)?.[0] ?? '';
    expect(todayLinks.match(/<a /g)).toHaveLength(2);
    expect(todayLinks).toContain('aria-current="page" href="/today">Today</a>');
    expect(todayLinks).toContain(`href="/today?week=${days[0]}"`);
  });

  it('includes people with an exception on any week day but limits the sidebar to today', () => {
    const tomorrow = days[2];
    const profiles = [
      {
        userId: 'anna',
        email: 'anna@example.com',
        firstName: 'Anna',
        lastName: 'Attendee',
        status: null,
        week: days.map((date) => ({
          date,
          status:
            date === tomorrow
              ? status({ status: 'VACATION', fromDate: tomorrow, toDate: tomorrow })
              : status({ status: 'IN_OFFICE', fromDate: date, toDate: date }),
        })),
      },
      {
        userId: 'ben',
        email: 'ben@example.com',
        firstName: 'Ben',
        lastName: 'Office',
        status: null,
        week: days.map((date) => ({
          date,
          status: status({ id: 0, fromDate: date, toDate: date }),
        })),
      },
    ];
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
        onStatusSaved: vi.fn(),
      })
    );
    const grid = html.match(/<div class="week-board"[\s\S]*?<\/main>/)?.[0] ?? '';
    const sidebar = html.match(/<aside[\s\S]*?<\/aside>/)?.[0] ?? '';
    expect(grid).toContain('Anna Attendee');
    expect(grid).toContain('<strong>Vacation</strong>');
    expect(grid).not.toContain('Ben Office');
    expect(sidebar).not.toContain('Anna Attendee');
    expect(sidebar).not.toContain('Ben Office');
  });

  it('keeps a week row with an exception on another day but omits it from today’s sidebar', () => {
    const tomorrow = days[2];
    const profiles = [
      {
        userId: 'anna',
        email: 'anna@example.com',
        firstName: 'Anna',
        lastName: 'Attendee',
        status: null,
        week: days.map((date) => ({
          date,
          status:
            date === tomorrow
              ? status({ status: 'ON_LEAVE', fromDate: tomorrow, toDate: tomorrow })
              : null,
        })),
      },
    ];
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
        onStatusSaved: vi.fn(),
      })
    );
    const grid = html.match(/<div class="week-board"[\s\S]*?<\/main>/)?.[0] ?? '';
    const sidebar = html.match(/<aside[\s\S]*?<\/aside>/)?.[0] ?? '';
    expect(grid).toContain('Anna Attendee');
    expect(grid).toContain('<strong>On leave</strong>');
    expect(sidebar).not.toContain('Anna Attendee');
  });
});

describe('today-only attendance', () => {
  it('renders one day column and the Today heading', () => {
    const { html, grid } = renderToday(status({ status: 'IN_LATE' }));
    expect(html).toContain('<h1>Today</h1>');
    expect(grid.match(/role="columnheader"/g) ?? []).toHaveLength(2); // colleague + today
    expect(grid).toContain('<strong>In late</strong>');
  });

  it('excludes IN_OFFICE from both the grid and sidebar, including assumed attendance', () => {
    for (const office of [status({ status: 'IN_OFFICE' }), status({ id: 0 })]) {
      const { grid, sidebar } = renderToday(office);
      expect(grid).not.toContain('Anna Attendee');
      expect(sidebar).not.toContain('Anna Attendee');
    }
  });

  it.each([
    status({ status: 'IN_LATE' }),
    status({ status: 'LEAVING_EARLY' }),
    status({ status: 'FROM_HOME' }),
    status({ status: 'AT_CLIENT' }),
    status({ status: 'SICK' }),
    status({ status: 'CHILD_SICK' }),
    status({ status: null, details: 'At a workshop' }),
    status({ status: 'VACATION' }),
    status({ status: 'ON_LEAVE' }),
    status({ status: 'AWAY' }),
  ])('keeps declared attendance exceptions visible in both areas', (todayStatus) => {
    const { grid, sidebar } = renderToday(todayStatus, status({ status: 'IN_OFFICE' }));
    expect(grid).toContain('Anna Attendee');
    expect(sidebar).toContain('Anna Attendee');
  });

  it('uses the selected date status rather than a different day or the profile status', () => {
    const { grid, sidebar } = renderToday(
      status({ status: 'VACATION' }),
      status({ status: 'IN_OFFICE' })
    );
    expect(grid).toContain('Anna Attendee');
    expect(grid).toContain('<strong>Vacation</strong>');
    expect(sidebar).toContain('Anna Attendee');
  });

  it('looks up today by date when the profile still has a full week of statuses', () => {
    const { grid, sidebar } = renderToday(status({ status: 'VACATION' }), null, [
      {
        date: days[0],
        status: status({ status: 'IN_OFFICE', fromDate: days[0], toDate: days[0] }),
      },
      { date: days[1], status: status({ status: 'VACATION', fromDate: days[1], toDate: days[1] }) },
      ...days.slice(2).map((date) => ({ date, status: null })),
    ]);

    expect(grid).toContain('Anna Attendee');
    expect(grid).toContain('<strong>Vacation</strong>');
    expect(grid).not.toContain('<strong>In office</strong>');
    expect(sidebar).toContain('Vacation');
  });

  it('excludes missing statuses while retaining an exception and office totals on an earlier day', () => {
    const yesterday = days[0];
    const profiles = [
      {
        userId: 'anna',
        email: 'anna@example.com',
        firstName: 'Anna',
        lastName: 'Missing',
        status: null,
        week: [{ date: yesterday, status: null }],
      },
      {
        userId: 'ben',
        email: 'ben@example.com',
        firstName: 'Ben',
        lastName: 'Leave',
        status: null,
        week: [
          {
            date: yesterday,
            status: status({
              userID: 'ben',
              status: 'ON_LEAVE',
              fromDate: yesterday,
              toDate: yesterday,
            }),
          },
        ],
      },
      {
        userId: 'cara',
        email: 'cara@example.com',
        firstName: 'Cara',
        lastName: 'Explicit',
        status: null,
        week: [
          {
            date: yesterday,
            status: status({
              userID: 'cara',
              status: 'IN_OFFICE',
              fromDate: yesterday,
              toDate: yesterday,
            }),
          },
        ],
      },
      {
        userId: 'dan',
        email: 'dan@example.com',
        firstName: 'Dan',
        lastName: 'Assumed',
        status: null,
        week: [
          {
            date: yesterday,
            status: status({ userID: 'dan', id: 0, fromDate: yesterday, toDate: yesterday }),
          },
        ],
      },
    ];
    const html = renderToStaticMarkup(
      React.createElement(WeekOverview, {
        profiles,
        userId: 'ben',
        days: [yesterday],
        today: days[1],
        weekStart: days[0],
        currentWeekStart: days[0],
        arrival: null,
        syncError: false,
        plans: [],
        onStatusSaved: vi.fn(),
      })
    );
    const grid = html.match(/<div class="week-board"[\s\S]*?<\/main>/)?.[0] ?? '';
    const sidebar = html.match(/<aside[\s\S]*?<\/aside>/)?.[0] ?? '';
    expect(grid).not.toContain('Anna Missing');
    expect(sidebar).not.toContain('Anna Missing');
    expect(grid).toContain('Ben Leave');
    expect(sidebar).toContain('Ben Leave');
    expect(grid).not.toContain('Cara Explicit');
    expect(sidebar).not.toContain('Cara Explicit');
    expect(grid).not.toContain('Dan Assumed');
    expect(sidebar).not.toContain('Dan Assumed');
    expect(grid).toContain('Colleagues <span>1</span>');
    expect(grid).toContain('<strong>2</strong> in office');
    expect(sidebar).toContain('<strong>2</strong> of 4 in the office');
  });

  it.each([days[0], days[2]])(
    'ignores an exception declared for %s when today defaults to office',
    (date) => {
      const resolved = resolveWorkWeek(
        [status({ status: 'FROM_HOME', fromDate: date, toDate: date })],
        'anna',
        days,
        new Date('2026-09-22T10:00:00Z')
      );
      const { grid, sidebar } = renderToday(null, null, resolved);

      expect(resolved[1].status).toMatchObject({ id: 0, status: 'IN_OFFICE' });
      expect(grid).not.toContain('Anna Attendee');
      expect(sidebar).not.toContain('Anna Attendee');
    }
  );

  it('shows only today’s note for a declaration spanning multiple days', () => {
    const spanning = status({
      status: 'IN_LATE',
      time: new Date('2026-09-22T08:00:00Z'),
      details: 'doctor',
      fromDate: days[1],
      toDate: days[3],
    });
    const { grid, sidebar } = renderToday(spanning);

    expect(grid).toContain('<small>from 10:00 · doctor</small>');
    expect(grid).not.toContain('until 24.09');
    expect(sidebar).toContain('In late · from 10:00 · doctor');
    expect(sidebar).not.toContain('until 24.09');
  });
});

describe('AI indicator', () => {
  function renderColleague(week: DayPresence[]) {
    const html = renderToStaticMarkup(
      React.createElement(WeekOverview, {
        profiles: [
          {
            userId: 'anna',
            email: 'anna@example.com',
            firstName: 'Anna',
            lastName: 'Attendee',
            status: null,
            week,
          },
        ],
        userId: 'someone-else',
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
    const grid = html.match(/<div class="week-board"[\s\S]*?<\/main>/)?.[0] ?? '';
    return {
      grid,
      sidebar: html.match(/<aside[\s\S]*?<\/aside>/)?.[0] ?? '',
      cells: grid.match(/<div role="cell"[^>]*class="week-cell[\s\S]*?<\/div>/g) ?? [],
    };
  }

  it('marks a colleague status interpreted by AI in the grid and the sidebar', () => {
    const { grid, sidebar } = renderColleague(
      days.map((date) => ({ date, status: status({ status: 'VACATION', origin: 'AI' }) }))
    );
    expect(grid).toContain('aria-label="Set by AI"');
    expect(grid).toMatch(/title="Vacation[^"]* · Set by AI"/);
    expect(sidebar).toContain('<span class="sr-only"> (Set by AI)</span>');
  });

  it('announces the indicator through the plan button instead of nesting a control', () => {
    const { grid } = renderWeek(status({ status: 'VACATION', origin: 'AI' }));
    expect(grid).toMatch(/aria-label="Plan [^"]+\. Currently: Vacation · Set by AI"/);
    expect(grid).not.toContain('aria-label="Set by AI"');
  });

  it.each(['MANUAL', 'SHORTHAND', null] as const)('does not mark %s statuses', (origin) => {
    const { grid, sidebar } = renderColleague(
      days.map((date) => ({ date, status: status({ status: 'VACATION', origin }) }))
    );
    expect(grid + sidebar).not.toContain('Set by AI');
  });

  it('follows the Declaration that determines each day, so a manual correction drops the mark', () => {
    const declared = status({
      id: 1,
      status: 'VACATION',
      origin: 'AI',
      sourceMessageKey: 'T:C:1790000000.000001',
    });
    const correction = status({
      id: 2,
      status: 'FROM_HOME',
      origin: 'MANUAL',
      fromDate: days[2],
      toDate: days[2],
      announcedAt: new Date('2026-09-20T07:00:00Z'),
    });
    const week = resolveWorkWeek(
      [declared, correction],
      'anna',
      days,
      new Date('2026-09-22T10:00:00Z')
    );
    const { cells } = renderColleague(week);

    expect(cells).toHaveLength(3);
    expect(cells[0]).toContain('aria-label="Set by AI"');
    expect(cells[1]).toContain('<strong>Home</strong>');
    expect(cells[1]).not.toContain('Set by AI');
    expect(cells[2]).toContain('aria-label="Set by AI"');
  });

  it('marks only an AI status in the colleague details', () => {
    const render = (origin: Status['origin']) =>
      renderToStaticMarkup(
        React.createElement(ProfileListItem, {
          user: {
            userId: 'anna',
            email: 'anna@example.com',
            firstName: 'Anna',
            lastName: 'Attendee',
            status: status({ status: 'SICK', origin }),
          },
          showStatus: true,
        })
      );
    expect(render('AI')).toContain('aria-label="Set by AI"');
    expect(render('MANUAL')).not.toContain('Set by AI');
  });
});
