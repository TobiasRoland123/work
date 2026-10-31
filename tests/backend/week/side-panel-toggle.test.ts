import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DayPresence } from '@/db/types';
import { WeekOverview } from '@/components/week/WeekOverview';
import {
  WEEK_PANEL_COOKIE,
  isWeekPanelOpen,
  rememberWeekPanel,
} from '@/components/week/panelPreference';
import { workWeekDays } from '@/lib/status/week';

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

function render(initialPanelOpen?: boolean) {
  const week: DayPresence[] = days.map((date) => ({ date, status: null }));
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
      initialPanelOpen,
    })
  );
  return {
    html,
    toggle: html.match(/<button[^>]*class="week-panel-toggle"[^>]*>/)?.[0] ?? '',
    body: html.match(/<div class="week-body"[^>]*>/)?.[0] ?? '',
  };
}

describe('side panel toggle', () => {
  it('shows the panel by default, with a toggle that controls it', () => {
    const { html, toggle, body } = render();
    expect(html).toContain('<aside id="day-panel" class="day-panel"');
    expect(toggle).toContain('aria-expanded="true"');
    expect(toggle).toContain('aria-controls="day-panel"');
    expect(toggle).toContain('aria-label="Side panel"');
    expect(toggle).toContain('title="Hide side panel"');
    expect(body).toContain('data-panel="open"');
  });

  it('renders no panel and gives the board the full width when closed', () => {
    const { html, toggle, body } = render(false);
    expect(html).not.toContain('<aside');
    expect(html).not.toContain('day-panel');
    expect(html).toContain('class="week-board"');
    expect(toggle).toContain('aria-expanded="false"');
    expect(toggle).not.toContain('aria-controls');
    expect(toggle).toContain('title="Show side panel"');
    expect(body).toContain('data-panel="closed"');
  });

  it('keeps the toggle in the toolbar next to the attendance view switch', () => {
    const { html } = render(false);
    expect(html).toMatch(
      /<div class="week-toolbar-actions"><div class="week-filters"[\s\S]*?<\/div><button[^>]*class="week-panel-toggle"/
    );
  });
});

describe('side panel preference', () => {
  it('is open unless explicitly closed', () => {
    expect(isWeekPanelOpen(undefined)).toBe(true);
    expect(isWeekPanelOpen('open')).toBe(true);
    expect(isWeekPanelOpen('garbage')).toBe(true);
    expect(isWeekPanelOpen('closed')).toBe(false);
  });

  it.each([
    [true, 'open'],
    [false, 'closed'],
  ])('remembers open=%s in a year-long cookie readable by the whole site', (open, value) => {
    const document = { cookie: '' };
    vi.stubGlobal('document', document);
    rememberWeekPanel(open);
    expect(document.cookie).toBe(
      `${WEEK_PANEL_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`
    );
  });
});
