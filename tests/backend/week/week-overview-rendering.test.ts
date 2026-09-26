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
    grid: html.match(/<div class="week-board"[\s\S]*?<\/main>/)?.[0] ?? '',
    sidebar: html.match(/<aside[\s\S]*?<\/aside>/)?.[0] ?? '',
  };
}

describe('status labels in the week grid and selected-day sidebar', () => {
  it.each([
    ['IN_OFFICE', 'In office'],
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
    expect(sidebar).toContain(`<small>${label}</small>`);
  });

  it('displays assumed office attendance in both areas and retains its grid annotation', () => {
    const { grid, sidebar } = renderWeek(status({ id: 0 }));
    expect(grid).toContain('<strong>In office</strong>');
    expect(grid).toContain('data-assumed="true"');
    expect(grid).toContain('<span class="sr-only"> (assumed)</span>');
    expect(sidebar).toContain('<small>In office</small>');
  });

  it('visibly identifies missing status in both areas', () => {
    const { grid, sidebar } = renderWeek(null);
    expect(grid).toContain('<strong>No status</strong>');
    expect(sidebar).toContain('<small>No status</small>');
  });

  it.each(['IN_OFFICE', 'IN_LATE'] as const)(
    'retains the %s label alongside its arrival time and details',
    (value) => {
      const { grid, sidebar } = renderWeek(
        status({ status: value, time: new Date('2026-09-22T08:30:00Z'), details: 'dentist' })
      );
      const label = value === 'IN_OFFICE' ? 'In office' : 'In late';
      expect(grid).toContain(`<strong>${label}</strong><small>from 10:30 · dentist</small>`);
      expect(sidebar).toContain(`<small>${label} · from 10:30 · dentist</small>`);
    }
  );

  it('retains description-only announcements in both areas', () => {
    const { grid, sidebar } = renderWeek(status({ status: null, details: 'At a workshop' }));
    expect(grid).toContain('<strong>Note</strong><small>At a workshop</small>');
    expect(sidebar).toContain('<small>Note · At a workshop</small>');
  });
});
