import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type React from 'react';
import {
  bucketWorkdays,
  buildProfile,
  officeShareSpread,
  seriesFor,
} from '@/lib/employee-stats/history';
import {
  calendarSpan,
  startedWorkdays,
  summarizeEmployeeStats,
  type PersonDays,
} from '@/lib/employee-stats/stats';

const mocked = vi.hoisted(() => ({
  requirePageUserId: vi.fn(),
  requireEmployeeStatsViewer: vi.fn(),
  requireEmployeeStatsAdmin: vi.fn(),
  isEmployeeStatsAdmin: vi.fn(),
  getEmployeeStats: vi.fn(),
  listEmployees: vi.fn(),
  getEmployeeProfile: vi.fn(),
  listEmployeeStatsAccess: vi.fn(),
}));

vi.mock('@/lib/auth/require-user', () => ({ requirePageUserId: mocked.requirePageUserId }));
vi.mock('@/lib/auth/employee-stats', () => ({
  requireEmployeeStatsViewer: mocked.requireEmployeeStatsViewer,
  requireEmployeeStatsAdmin: mocked.requireEmployeeStatsAdmin,
  isEmployeeStatsAdmin: mocked.isEmployeeStatsAdmin,
}));
vi.mock('@/lib/employee-stats/service', () => ({
  getEmployeeStats: mocked.getEmployeeStats,
  listEmployees: mocked.listEmployees,
  getEmployeeProfile: mocked.getEmployeeProfile,
}));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/lib/employee-stats/access', () => ({
  listEmployeeStatsAccess: mocked.listEmployeeStatsAccess,
}));
vi.mock('@/components/layout/PageHeader', () => ({
  PageHeader: ({ actions }: { actions?: React.ReactNode }) => actions ?? null,
}));
vi.mock('@/app/(authenticated)/employee-stats/employee-stats.css', () => ({}));
vi.mock('@/app/(authenticated)/employee-stats/access/AccessManager', () => ({
  AccessManager: () => null,
}));
vi.mock('next/link', async () => {
  const React = await import('react');
  return {
    default: ({ href, children }: { href: string; children: React.ReactNode }) =>
      React.createElement('a', { href }, children),
  };
});

import EmployeeStatsPage from '@/app/(authenticated)/employee-stats/page';
import EmployeeDirectoryPage from '@/app/(authenticated)/employee-stats/people/page';
import EmployeeProfilePage from '@/app/(authenticated)/employee-stats/people/[userId]/page';
import EmployeeStatsAccessPage from '@/app/(authenticated)/employee-stats/access/page';

const OFFICE = 0;
const REMOTE = 1;
const SICK = 3;

const overviewDays = ['2026-09-21', '2026-09-22'];
const overviewPeople: PersonDays[] = [
  { userId: 'a', name: 'Anna Hansen', email: 'anna@example.com', codes: [OFFICE, SICK] },
];
const overviewBuckets = bucketWorkdays(overviewDays);
const stats = (overrides = {}) => ({
  range: 30,
  sort: 'name',
  startDate: '2026-09-01',
  endDate: '2026-09-30',
  workdays: 2,
  granularity: overviewBuckets.granularity,
  series: seriesFor(overviewPeople, overviewBuckets.buckets),
  spread: officeShareSpread(overviewPeople, overviewBuckets.buckets),
  ...summarizeEmployeeStats(overviewPeople, overviewDays),
  ...overrides,
});

const directory = [
  { userId: 'u1', name: 'Mads Nielsen', email: 'mads@example.com' },
  { userId: 'u2', name: 'Anna Hansen', email: 'anna@example.com' },
  { userId: 'u3', name: 'Freja Holm', email: 'freja@example.com' },
  { userId: 'u4', name: 'Jonas Krogh', email: 'jonas@example.com' },
  { userId: 'u5', name: 'Ida Bech', email: 'ida@example.com' },
];

const profileNow = new Date('2026-10-16T12:00:00Z');
const profileDays = startedWorkdays(calendarSpan('2026-09-14', '2026-10-16'), profileNow);
const cycle = (pattern: number[]) =>
  profileDays.map((_, index) => pattern[index % pattern.length]!);
const profileSubject: PersonDays = {
  userId: 'u1',
  name: 'Mads Nielsen',
  email: 'mads@example.com',
  codes: cycle([OFFICE, OFFICE, REMOTE, SICK, OFFICE]),
};
const profileColleagues: PersonDays[] = [
  { userId: 'u2', name: 'Anna Hansen', email: 'anna@example.com', codes: cycle([OFFICE, REMOTE]) },
  { userId: 'u3', name: 'Freja Holm', email: 'freja@example.com', codes: cycle([REMOTE]) },
  { userId: 'u4', name: 'Jonas Krogh', email: 'jonas@example.com', codes: cycle([OFFICE]) },
  {
    userId: 'u5',
    name: 'Ida Bech',
    email: 'ida@example.com',
    codes: cycle([OFFICE, OFFICE, REMOTE]),
  },
];
const profile = (compare: 'norm' | 'alone' = 'norm', range: number | 'all' = 30) => ({
  range,
  compare,
  endDate: '2026-10-16',
  employee: { userId: 'u1', name: 'Mads Nielsen', email: 'mads@example.com' },
  ...buildProfile(profileDays, profileSubject, compare === 'norm' ? profileColleagues : []),
});

beforeEach(() => {
  mocked.requirePageUserId.mockReset().mockResolvedValue('viewer-user');
  mocked.requireEmployeeStatsViewer.mockReset().mockResolvedValue('viewer-user');
  mocked.requireEmployeeStatsAdmin.mockReset().mockResolvedValue('admin-user');
  mocked.isEmployeeStatsAdmin.mockReset().mockResolvedValue(false);
  mocked.getEmployeeStats.mockReset().mockResolvedValue(stats());
  mocked.listEmployees.mockReset().mockResolvedValue(directory);
  mocked.getEmployeeProfile.mockReset().mockResolvedValue(profile());
  mocked.listEmployeeStatsAccess.mockReset().mockResolvedValue([]);
});

describe('employee stats page authorization', () => {
  it('does not load stats without a session', async () => {
    mocked.requirePageUserId.mockRejectedValueOnce(new Error('LOGIN'));
    await expect(EmployeeStatsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('LOGIN');
    expect(mocked.requireEmployeeStatsViewer).not.toHaveBeenCalled();
    expect(mocked.getEmployeeStats).not.toHaveBeenCalled();
  });

  it('does not load stats when the live permission is denied', async () => {
    mocked.requireEmployeeStatsViewer.mockRejectedValueOnce(new Error('NOT_FOUND'));
    await expect(EmployeeStatsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'NOT_FOUND'
    );
    expect(mocked.getEmployeeStats).not.toHaveBeenCalled();
  });

  it('loads the requested period and sort after both checks pass', async () => {
    await EmployeeStatsPage({ searchParams: Promise.resolve({ days: '7', sort: 'sick' }) });
    expect(mocked.getEmployeeStats).toHaveBeenCalledWith({ days: '7', sort: 'sick' });
  });

  it('ignores repeated query parameters instead of passing arrays on', async () => {
    await EmployeeStatsPage({ searchParams: Promise.resolve({ days: ['7', '90'] }) });
    expect(mocked.getEmployeeStats).toHaveBeenCalledWith({ days: undefined, sort: undefined });
  });
});

describe('employee stats page content', () => {
  const render = async () =>
    renderToStaticMarkup(await EmployeeStatsPage({ searchParams: Promise.resolve({}) }));

  it('shows the figures and each employee', async () => {
    const html = await render();
    expect(html).toContain('Last 30 days');
    expect(html).toContain('Anna Hansen');
    expect(html).toContain('anna@example.com');
    expect(html).toContain('Office share');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('undefined');
  });

  it('links to the access controls only for the admin', async () => {
    expect(await render()).not.toContain('/employee-stats/access');
    mocked.isEmployeeStatsAdmin.mockResolvedValue(true);
    expect(await render()).toContain('href="/employee-stats/access"');
    expect(mocked.isEmployeeStatsAdmin).toHaveBeenLastCalledWith('viewer-user');
  });

  it('shows an empty state without a division by zero', async () => {
    mocked.getEmployeeStats.mockResolvedValue(
      stats({ ...summarizeEmployeeStats([], []), workdays: 0 })
    );
    const html = await render();
    expect(html).toContain('No active employees were found.');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
  });

  it('keeps the chosen sort when switching period', async () => {
    mocked.getEmployeeStats.mockResolvedValue(stats({ sort: 'vacation' }));
    const html = await render();
    expect(html).toContain('href="/employee-stats?days=7&amp;sort=vacation"');
    expect(html).toContain('href="/employee-stats?days=90&amp;sort=vacation"');
  });

  it('offers longer periods than 90 days, up to all time', async () => {
    const html = await render();
    expect(html).toContain('href="/employee-stats?days=180"');
    expect(html).toContain('href="/employee-stats?days=365"');
    expect(html).toContain('href="/employee-stats?days=all"');
    expect(html).toContain('>All time<');
    expect(html).toContain('>6 months<');
  });

  it('labels an all-time view', async () => {
    mocked.getEmployeeStats.mockResolvedValue(stats({ range: 'all' }));
    expect(await render()).toContain('<h2 id="stats-period-heading">All time</h2>');
  });

  it('draws the charts and links each employee to their own page', async () => {
    const html = await render();
    expect(html).toContain('data-chart="attendance"');
    expect(html).toContain('data-chart="trend"');
    expect(html).toContain('data-chart="weekday"');
    expect(html).toContain('href="/employee-stats/people/a?days=30"');
    expect(html).toContain('href="/employee-stats/people"');
  });

  it('keeps the chosen period on the links to each employee', async () => {
    mocked.getEmployeeStats.mockResolvedValue(stats({ range: 'all' }));
    expect(await render()).toContain('href="/employee-stats/people/a?days=all"');
  });

  it('says so when no workday has started in the period', async () => {
    mocked.getEmployeeStats.mockResolvedValue(stats({ workdays: 0 }));
    const html = await render();
    expect(html).toContain('No workdays have started in this period yet.');
    expect(html).not.toContain('NaN');
  });
});

describe('employee directory page', () => {
  const renderDirectory = async (searchParams = {}) =>
    renderToStaticMarkup(
      await EmployeeDirectoryPage({ searchParams: Promise.resolve(searchParams) })
    );

  it('does not list employees without a session or without the live permission', async () => {
    mocked.requirePageUserId.mockRejectedValueOnce(new Error('LOGIN'));
    await expect(renderDirectory()).rejects.toThrow('LOGIN');
    mocked.requireEmployeeStatsViewer.mockRejectedValueOnce(new Error('NOT_FOUND'));
    await expect(renderDirectory()).rejects.toThrow('NOT_FOUND');
    expect(mocked.listEmployees).not.toHaveBeenCalled();
  });

  it('lists everyone with a link to their own page', async () => {
    const html = await renderDirectory();
    expect(html).toContain('Search employees');
    for (const person of directory) {
      expect(html).toContain(`href="/employee-stats/people/${person.userId}"`);
      expect(html).toContain(person.name);
    }
    expect(html).toContain('5 of 5 employees');
  });

  it('applies a search from the address, for browsers without JavaScript', async () => {
    const html = await renderDirectory({ q: 'jon' });
    expect(html).toContain('Jonas Krogh');
    expect(html).not.toContain('Mads Nielsen');
    expect(html).toContain('1 of 5 employees');
  });

  it('finds people whatever the case or accents, by name or email', async () => {
    expect(await renderDirectory({ q: 'FREJA holm' })).toContain('1 of 5 employees');
    expect(await renderDirectory({ q: 'ida@example' })).toContain('Ida Bech');
    expect(await renderDirectory({ q: 'nobody' })).toContain('No employees match.');
  });

  it('shows the access link only to the admin', async () => {
    expect(await renderDirectory()).not.toContain('/employee-stats/access');
    mocked.isEmployeeStatsAdmin.mockResolvedValue(true);
    expect(await renderDirectory()).toContain('href="/employee-stats/access"');
  });
});

describe('employee profile page', () => {
  const renderProfile = async (searchParams = {}, userId = 'u1') =>
    renderToStaticMarkup(
      await EmployeeProfilePage({
        params: Promise.resolve({ userId }),
        searchParams: Promise.resolve(searchParams),
      })
    );

  it('does not load anyone without a session or without the live permission', async () => {
    mocked.requirePageUserId.mockRejectedValueOnce(new Error('LOGIN'));
    await expect(renderProfile()).rejects.toThrow('LOGIN');
    mocked.requireEmployeeStatsViewer.mockRejectedValueOnce(new Error('NOT_FOUND'));
    await expect(renderProfile()).rejects.toThrow('NOT_FOUND');
    expect(mocked.getEmployeeProfile).not.toHaveBeenCalled();
    expect(mocked.listEmployees).not.toHaveBeenCalled();
  });

  it('asks for the person, period and comparison in the address', async () => {
    await renderProfile({ days: 'all', compare: 'alone' }, 'u9');
    expect(mocked.getEmployeeProfile).toHaveBeenCalledWith({
      userId: 'u9',
      days: 'all',
      compare: 'alone',
    });
  });

  it('shows not found for someone who is not an active employee', async () => {
    mocked.getEmployeeProfile.mockResolvedValue(null);
    await expect(renderProfile({}, 'gone')).rejects.toThrow('NOT_FOUND');
  });

  it('draws every chart for the person', async () => {
    const html = await renderProfile();
    expect(html).toContain('Mads Nielsen');
    for (const chart of ['attendance', 'trend', 'weekday', 'calendar']) {
      expect(html).toContain(`data-chart="${chart}"`);
    }
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('Infinity');
  });

  it('compares with the norm: a norm line, a band and the gap to it', async () => {
    const html = await renderProfile({ compare: 'norm' });
    expect(html).toContain('data-line="norm"');
    expect(html).toContain('class="stats-band"');
    expect(html).toContain('Norm (4 colleagues)');
    expect(html).toContain('stats-bar-norm');
    expect(html).toContain('stats-norm-tick');
    expect(html).toMatch(/Norm \d+% · /);
    expect(html).toContain('Ahead of');
    expect(html).toContain('over the same workdays');
  });

  it('shows only the person when asked: no norm anywhere', async () => {
    mocked.getEmployeeProfile.mockResolvedValue(profile('alone'));
    const html = await renderProfile({ compare: 'alone' });
    expect(html).not.toContain('data-line="norm"');
    expect(html).not.toContain('stats-band');
    expect(html).not.toContain('stats-bar-norm');
    expect(html).not.toContain('stats-norm-tick');
    expect(html).not.toContain('Ahead of');
    expect(html).not.toContain('colleagues');
    expect(html).toContain('This view shows only this person.');
  });

  it('switches between the views and periods without losing the other choice', async () => {
    mocked.getEmployeeProfile.mockResolvedValue(profile('norm', 90));
    const html = await renderProfile({ days: '90' });
    expect(html).toContain('href="/employee-stats/people/u1?days=90&amp;compare=alone"');
    expect(html).toContain('href="/employee-stats/people/u1?days=all&amp;compare=norm"');
    expect(html).toContain('Mads only');
  });

  it('keeps the period and comparison when searching for someone else', async () => {
    const html = await renderProfile({ days: '30' });
    expect(html).toContain('Search employees');
    expect(html).not.toContain('/employee-stats/people/u2?days=30&amp;compare=norm');
  });

  it('explains a missing norm instead of drawing an empty one', async () => {
    mocked.getEmployeeProfile.mockResolvedValue({ ...profile('alone'), compare: 'norm' });
    const html = await renderProfile();
    expect(html).toContain('There are no colleagues to compare with yet.');
    expect(html).not.toContain('data-line="norm"');
  });

  it('has a clear empty state for a person without days on record', async () => {
    mocked.getEmployeeProfile.mockResolvedValue({
      ...profile('norm'),
      ...buildProfile([], { ...profileSubject, codes: [] }, []),
    });
    const html = await renderProfile();
    expect(html).toContain('has no workdays on record in this period');
    expect(html).not.toContain('NaN');
  });
});

describe('employee stats access page authorization', () => {
  it('does not list people without a session', async () => {
    mocked.requirePageUserId.mockRejectedValueOnce(new Error('LOGIN'));
    await expect(EmployeeStatsAccessPage()).rejects.toThrow('LOGIN');
    expect(mocked.requireEmployeeStatsAdmin).not.toHaveBeenCalled();
    expect(mocked.listEmployeeStatsAccess).not.toHaveBeenCalled();
  });

  it('does not list people for a viewer who is not the admin', async () => {
    mocked.requireEmployeeStatsAdmin.mockRejectedValueOnce(new Error('NOT_FOUND'));
    await expect(EmployeeStatsAccessPage()).rejects.toThrow('NOT_FOUND');
    expect(mocked.listEmployeeStatsAccess).not.toHaveBeenCalled();
    expect(mocked.requireEmployeeStatsViewer).not.toHaveBeenCalled();
  });

  it('lists people for the admin', async () => {
    const html = renderToStaticMarkup(await EmployeeStatsAccessPage());
    expect(mocked.listEmployeeStatsAccess).toHaveBeenCalledOnce();
    expect(html).toContain('href="/employee-stats"');
  });
});
