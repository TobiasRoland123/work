import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { select } = vi.hoisted(() => ({ select: vi.fn() }));

vi.mock('@/db', () => ({ db: { select } }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: null }));

import { userService } from '@/lib/services/userService';
import * as active from '@/lib/status/active';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function query<T>(promise: Promise<T>, onStart: () => void) {
  const builder: Record<string, unknown> & {
    then: Promise<T>['then'];
  } = {
    then: (onFulfilled, onRejected) => {
      onStart();
      return promise.then(onFulfilled, onRejected);
    },
  };
  for (const method of ['from', 'where', 'orderBy', 'leftJoin', 'limit']) {
    builder[method] = () => builder;
  }
  return builder;
}

const user = {
  userId: 'user-1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  mobilePhone: '555-0100',
  organisationId: 4,
  slackDeactivated: false,
};

const status = {
  id: 12,
  userID: user.userId,
  status: 'FROM_HOME',
  details: 'Working remotely',
  time: null,
  fromDate: '2000-01-01',
  toDate: '2999-12-31',
  startsAt: null,
  endsAt: null,
  startsAtApproximate: false,
  endsAtApproximate: false,
  createdAt: '2026-09-20T08:00:00Z',
  announcedAt: new Date('2026-09-20T08:00:00Z'),
  sourceMessageKey: null,
};

function useQueries(results: Promise<unknown>[]) {
  const pending = [...results];
  let callNumber = 0;
  let started = 0;
  select.mockImplementation(() => {
    const result = pending.shift();
    callNumber += 1;
    if (!result) throw new Error(`Unexpected database query ${callNumber}`);
    return query(result, () => started++);
  });
  return () => started;
}

beforeEach(() => {
  select.mockReset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-25T08:00:00Z'));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('userService parallel relation reads', () => {
  it('starts all getUserById reads together and preserves enriched values', async () => {
    const organisation = deferred<unknown[]>();
    const statuses = deferred<unknown[]>();
    const roles = deferred<unknown[]>();
    const phones = deferred<unknown[]>();
    const started = useQueries([
      Promise.resolve([user]),
      organisation.promise,
      statuses.promise,
      roles.promise,
      phones.promise,
    ]);

    const resultPromise = userService.getUserById(user.userId);
    await vi.waitFor(() => expect(started()).toBe(5));

    organisation.resolve([{ id: 4, organisationName: 'Analytical Engines' }]);
    statuses.resolve([status]);
    roles.resolve([{ role: 'Engineer' }, { role: null }]);
    phones.resolve([{ businessPhoneNumber: '555-0199' }]);

    await expect(resultPromise).resolves.toMatchObject({
      ...user,
      organisation: 'Analytical Engines',
      organisationRoles: ['Engineer'],
      businessPhoneNumber: '555-0199',
      status,
    });
  });

  it('preserves null defaults when the user has no optional relations or status', async () => {
    const userWithoutOrganisation = { ...user, organisationId: null };
    useQueries([
      Promise.resolve([userWithoutOrganisation]),
      Promise.resolve([]),
      Promise.resolve([]),
      Promise.resolve([]),
    ]);

    vi.setSystemTime(new Date('2026-09-26T10:00:00+02:00'));
    await expect(userService.getUserById(user.userId)).resolves.toMatchObject({
      ...userWithoutOrganisation,
      organisation: null,
      organisationRoles: [],
      businessPhoneNumber: null,
      status: null,
    });
    expect(select).toHaveBeenCalledTimes(4);
  });

  it('starts getAllUsers relation reads together and preserves list enrichment', async () => {
    const otherUser = { ...user, userId: 'user-2', firstName: 'Grace', organisationId: 5 };
    const otherStatus = { ...status, id: 13, userID: otherUser.userId, status: 'SICK' };
    const organisations = deferred<unknown[]>();
    const roles = deferred<unknown[]>();
    const phones = deferred<unknown[]>();
    const statuses = deferred<unknown[]>();
    const started = useQueries([
      Promise.resolve([user, otherUser]),
      organisations.promise,
      roles.promise,
      phones.promise,
      statuses.promise,
    ]);

    const resultPromise = userService.getAllUsers(false, [
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
    ]);
    await vi.waitFor(() => expect(started()).toBe(5));

    organisations.resolve([
      { id: 4, organisationName: 'Analytical Engines' },
      { id: 5, organisationName: 'Compilers' },
    ]);
    roles.resolve([
      { userId: otherUser.userId, role: 'Admiral' },
      { userId: user.userId, role: 'Engineer' },
    ]);
    phones.resolve([
      { userId: otherUser.userId, businessPhoneNumber: '555-0200' },
      { userId: user.userId, businessPhoneNumber: '555-0199' },
    ]);
    statuses.resolve([otherStatus, status]);

    const result = await resultPromise;
    expect(result.map((person) => person.userId)).toEqual([user.userId, otherUser.userId]);
    expect(result[0]).toMatchObject({
      ...user,
      organisation: 'Analytical Engines',
      organisationRoles: ['Engineer'],
      businessPhoneNumber: '555-0199',
      status,
      week: [
        { date: '2026-09-21', status },
        { date: '2026-09-22', status },
        { date: '2026-09-23', status },
        { date: '2026-09-24', status },
        { date: '2026-09-25', status },
      ],
    });
    expect(result[1]).toMatchObject({
      ...otherUser,
      organisation: 'Compilers',
      organisationRoles: ['Admiral'],
      businessPhoneNumber: '555-0200',
      status: otherStatus,
    });
    expect(result[1].week?.map((day) => day.status?.userID)).toEqual(
      Array(5).fill(otherUser.userId)
    );
  });

  it('returns null for a missing user without starting relation reads', async () => {
    const started = useQueries([Promise.resolve([])]);

    await expect(userService.getUserById('missing')).resolves.toBeNull();
    expect(select).toHaveBeenCalledTimes(1);
    expect(started()).toBe(1);
  });

  it('reuses the today cell even when its presence is null after an expired clock interval', async () => {
    const resolvePresence = vi.spyOn(active, 'resolvePresenceStatus');
    useQueries([
      Promise.resolve([user]),
      Promise.resolve([]),
      Promise.resolve([]),
      Promise.resolve([]),
      Promise.resolve([
        {
          ...status,
          fromDate: '2026-09-25',
          toDate: '2026-09-25',
          endsAt: new Date('2026-09-25T07:00:00Z'),
        },
      ]),
    ]);

    const result = await userService.getAllUsers(false, ['2026-09-25']);
    expect(result[0].status).toBeNull();
    expect(result[0].week?.[0].status).toBeNull();
    expect(resolvePresence).toHaveBeenCalledTimes(1);
  });
});
