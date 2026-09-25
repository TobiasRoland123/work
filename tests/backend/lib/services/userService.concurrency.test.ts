import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { select } = vi.hoisted(() => ({ select: vi.fn() }));

vi.mock('@/db', () => ({ db: { select } }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: null }));

import { userService } from '@/lib/services/userService';

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
    const organisations = deferred<unknown[]>();
    const roles = deferred<unknown[]>();
    const phones = deferred<unknown[]>();
    const statuses = deferred<unknown[]>();
    const started = useQueries([
      Promise.resolve([user]),
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

    organisations.resolve([{ id: 4, organisationName: 'Analytical Engines' }]);
    roles.resolve([{ userId: user.userId, role: 'Engineer' }]);
    phones.resolve([{ userId: user.userId, businessPhoneNumber: '555-0199' }]);
    statuses.resolve([status]);

    const result = await resultPromise;
    expect(result).toHaveLength(1);
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
  });

  it('returns null for a missing user without starting relation reads', async () => {
    const started = useQueries([Promise.resolve([])]);

    await expect(userService.getUserById('missing')).resolves.toBeNull();
    expect(select).toHaveBeenCalledTimes(1);
    expect(started()).toBe(1);
  });
});
