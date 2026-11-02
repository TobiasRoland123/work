import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Status } from '@/db/types';
import { copenhagenDate } from '@/lib/status/active';
import { addDays, workWeekDays } from '@/lib/status/week';

const mocked = vi.hoisted(() => ({
  requireUserId: vi.fn(),
  isAdmin: vi.fn(),
  getUserRole: vi.fn(),
  createNewStatus: vi.fn(),
}));

vi.mock('@/lib/auth/require-user', () => ({ requireUserId: mocked.requireUserId }));
vi.mock('@/lib/auth/roles', () => ({
  isAdmin: mocked.isAdmin,
  getUserRole: mocked.getUserRole,
}));
vi.mock('@/lib/services/statusService', () => ({
  statusService: { createNewStatus: mocked.createNewStatus },
}));

import { planColleagueStatusAction, planStatusAction } from '@/app/actions/statusActions';

const from = addDays(copenhagenDate(), 7);
const plan = { status: 'FROM_HOME', when: { kind: 'range', from, to: addDays(from, 1) } };

describe('setting a colleague’s status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.requireUserId.mockResolvedValue('admin');
    mocked.isAdmin.mockResolvedValue(true);
    mocked.getUserRole.mockResolvedValue('EMPLOYEE');
    mocked.createNewStatus.mockResolvedValue({});
  });

  it('saves the plan on the colleague’s behalf for an admin', async () => {
    await expect(planColleagueStatusAction('colleague', plan)).resolves.toEqual({
      ok: true,
      count: 1,
    });
    expect(mocked.isAdmin).toHaveBeenCalledWith('admin');
    expect(mocked.createNewStatus).toHaveBeenCalledWith(
      expect.objectContaining({ userID: 'colleague', status: 'FROM_HOME', fromDate: from })
    );
  });

  it('refuses managers and employees', async () => {
    mocked.isAdmin.mockResolvedValue(false);
    const result = await planColleagueStatusAction('colleague', plan);
    expect(result.ok).toBe(false);
    expect(mocked.createNewStatus).not.toHaveBeenCalled();
  });

  it('refuses people outside the active workspace', async () => {
    mocked.getUserRole.mockResolvedValue(null);
    const result = await planColleagueStatusAction('departed', plan);
    expect(result).toEqual({
      ok: false,
      error: 'That person is not an active member of the workspace.',
    });
    expect(mocked.createNewStatus).not.toHaveBeenCalled();
  });

  it('rejects a non-string colleague id', async () => {
    const result = await planColleagueStatusAction({ userId: 'colleague' }, plan);
    expect(result.ok).toBe(false);
    expect(mocked.createNewStatus).not.toHaveBeenCalled();
  });

  it('keeps saving the signed-in person’s own plan without an admin check', async () => {
    mocked.requireUserId.mockResolvedValue('employee');
    await expect(planStatusAction(plan)).resolves.toEqual({ ok: true, count: 1 });
    expect(mocked.isAdmin).not.toHaveBeenCalled();
    expect(mocked.createNewStatus).toHaveBeenCalledWith(
      expect.objectContaining({ userID: 'employee' })
    );
  });
});

describe('week board planning buttons', () => {
  vi.mock('@/components/layout/PageHeader', () => ({
    PageHeader: ({ title }: { title: string }) => React.createElement('h1', null, title),
  }));
  vi.mock('@/components/layout/StatusDialog', () => ({ StatusDialog: () => null }));
  vi.mock('@/components/week/week.css', () => ({}));

  beforeEach(() => vi.stubGlobal('React', React));
  afterEach(() => vi.unstubAllGlobals());

  const days = workWeekDays('2026-09-21');
  const vacation: Status = {
    id: 7,
    userID: 'mads',
    status: 'VACATION',
    details: null,
    emoji: null,
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
  };

  async function renderBoard(canSetColleagueStatus: boolean) {
    const { WeekOverview } = await import('@/components/week/WeekOverview');
    return renderToStaticMarkup(
      React.createElement(WeekOverview, {
        profiles: [
          {
            userId: 'mads',
            email: 'mads@example.com',
            firstName: 'Mads',
            lastName: 'Madsen',
            status: vacation,
            week: days.map((date) => ({ date, status: vacation })),
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
        canSetColleagueStatus,
      })
    );
  }

  it('lets an admin plan a colleague’s days from the board', async () => {
    expect(await renderBoard(true)).toContain('aria-label="Set status for Mads Madsen on');
  });

  it('shows colleagues’ cells read-only to everyone else', async () => {
    const html = await renderBoard(false);
    expect(html).not.toContain('Set status for');
    expect(html).not.toContain('class="week-cell-plan"');
  });
});
