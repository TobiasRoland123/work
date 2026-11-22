import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Status } from '@/db/types';

const mocks = vi.hoisted(() => ({
  requireEmployeeStatsViewer: vi.fn(),
  select: vi.fn(),
  data: [] as unknown[][],
}));

vi.mock('@/lib/auth/employee-stats', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/employee-stats')>()),
  requireEmployeeStatsViewer: mocks.requireEmployeeStatsViewer,
}));
vi.mock('@/db', () => ({ db: { select: mocks.select } }));

import { getEmployeeProfile, getEmployeeStats } from '@/lib/employee-stats/service';

const member = (userId: string, name: string, createdAt: string) => ({
  userId,
  firstName: name,
  lastName: 'Test',
  email: `${userId}@example.com`,
  createdAt,
});

const statusRow = (userID: string, values: Partial<Status>): Status => ({
  id: 1,
  userID,
  status: 'SICK',
  fromDate: '2025-05-05',
  toDate: '2025-05-07',
  details: null,
  emoji: null,
  startsAt: null,
  endsAt: null,
  startsAtApproximate: false,
  endsAtApproximate: false,
  sourceMessageKey: null,
  createdAt: '2025-05-05 08:00:00',
  announcedAt: new Date('2025-05-05T08:00:00Z'),
  time: null,
  ...values,
});

beforeEach(() => {
  vi.stubEnv('SLACK_TEAM_ID', 'T_TEST');
  mocks.requireEmployeeStatsViewer.mockReset().mockResolvedValue('viewer');
  mocks.data.length = 0;
  mocks.select.mockReset().mockImplementation(() => {
    const rows = mocks.data.shift() ?? [];
    const builder = {
      from: vi.fn(() => builder),
      where: vi.fn(() => builder),
      groupBy: vi.fn(() => builder),
      then: (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(rows).then(resolve, reject),
    };
    return builder;
  });
});

describe('employee stats start date floor', () => {
  it('clamps all-time and rolling periods that reach into 2025 to 1 January 2026', async () => {
    const now = new Date('2026-04-10T10:00:00Z');
    const employees = [
      member('u1', 'Anna', '2025-05-01 08:00:00'),
      member('u2', 'Mads', '2025-05-15 08:00:00'),
    ];
    const firstRows = [{ userId: 'u1', firstDay: '2025-05-05' }];
    const janRemote = statusRow('u1', {
      id: 2,
      status: 'FROM_HOME',
      fromDate: '2026-01-02',
      toDate: '2026-01-02',
      createdAt: '2026-01-02 08:00:00',
      announcedAt: new Date('2026-01-02T08:00:00Z'),
    });

    for (const days of ['all', '365', '180']) {
      mocks.data.push(employees, firstRows, [janRemote]);
      const stats = await getEmployeeStats({ days }, now);
      expect(stats.startDate).toBe('2026-01-01');
      expect(stats.endDate).toBe('2026-04-10');
      expect(stats.workdays).toBe(72);
      expect(stats.totals.counts.remote).toBe(1);
      expect(stats.totals.counts.sick).toBe(0);
    }
  });

  it('starts employee profiles no earlier than 1 January 2026', async () => {
    const now = new Date('2026-04-10T10:00:00Z');
    mocks.data.push(
      [member('u1', 'Anna', '2025-05-01 08:00:00'), member('u2', 'Mads', '2025-05-15 08:00:00')],
      [{ userId: 'u1', firstDay: '2025-05-05' }],
      []
    );
    const profile = await getEmployeeProfile({ userId: 'u1', days: 'all', compare: 'norm' }, now);
    expect(profile?.workdays[0]).toBe('2026-01-01');
    expect(profile?.workdays).toHaveLength(72);
  });

  it('preserves later start dates when all employees joined after January 2026', async () => {
    const now = new Date('2026-04-10T10:00:00Z');
    mocks.data.push([member('u1', 'Nina', '2026-03-02 08:00:00')], [], []);
    const stats = await getEmployeeStats({ days: 'all' }, now);
    expect(stats.startDate).toBe('2026-03-02');
    expect(stats.workdays).toBe(30);
  });
});
