import { describe, expect, it } from 'vitest';
import { isStatusApplicable, selectActiveStatus } from '@/lib/status/active';

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  createdAt: '2026-09-07T08:00:00.000Z',
  fromDate: null,
  toDate: null,
  startsAt: null,
  endsAt: null,
  ...overrides,
});

describe('active status selection', () => {
  it('uses Copenhagen dates for inclusive date ranges', () => {
    const status = row({ fromDate: '2026-09-07', toDate: '2026-09-07' });
    expect(isStatusApplicable(status, new Date('2026-09-06T22:30:00.000Z'))).toBe(true);
    expect(isStatusApplicable(status, new Date('2026-09-07T22:01:00.000Z'))).toBe(false);
  });

  it('treats timed statuses as half open intervals and skips future rows', () => {
    const current = row({
      id: 1,
      startsAt: '2026-09-07T08:00:00Z',
      endsAt: '2026-09-07T09:00:00Z',
    });
    const future = row({
      id: 2,
      createdAt: '2026-09-07T07:30:00Z',
      startsAt: '2026-09-07T10:00:00Z',
    });
    expect(isStatusApplicable(current, new Date('2026-09-07T08:00:00Z'))).toBe(true);
    expect(isStatusApplicable(current, new Date('2026-09-07T09:00:00Z'))).toBe(false);
    expect(selectActiveStatus([current, future], new Date('2026-09-07T08:30:00Z'))).toBe(current);
  });

  it('resumes an older applicable range after a newer interval ends', () => {
    const older = row({
      id: 1,
      createdAt: '2026-09-07T07:00:00Z',
      fromDate: '2026-09-07',
      toDate: '2026-09-10',
    });
    const newer = row({
      id: 2,
      createdAt: '2026-09-07T08:00:00Z',
      startsAt: '2026-09-07T08:00:00Z',
      endsAt: '2026-09-07T09:00:00Z',
    });
    expect(selectActiveStatus([older, newer], new Date('2026-09-07T09:00:00Z'))).toBe(older);
  });
});

it('does not expire approximate arrival at its nominal clock time', () => {
  const late = row({
    fromDate: '2026-09-07',
    toDate: '2026-09-07',
    startsAt: new Date('2026-09-06T22:00:00Z'),
    endsAt: new Date('2026-09-07T08:00:00Z'),
  });
  expect(
    selectActiveStatus([{ ...late, endsAtApproximate: true }], new Date('2026-09-07T09:00:00Z'))
  ).not.toBeNull();
  expect(
    selectActiveStatus([{ ...late, endsAtApproximate: true }], new Date('2026-09-07T22:00:00Z'))
  ).toBeNull();
});

it('orders UTC announcement instants across mixed database wall-clock createdAt values', () => {
  const manual = {
    ...row({ createdAt: '2026-09-07 10:00:00', fromDate: '2026-09-07', toDate: '2026-09-07' }),
    announcedAt: new Date('2026-09-07T08:00:00Z'),
  };
  const imported = {
    ...row({ createdAt: '2026-09-07 09:00:00', fromDate: '2026-09-07', toDate: '2026-09-07' }),
    announcedAt: new Date('2026-09-07T09:00:00Z'),
  };
  expect(selectActiveStatus([manual, imported], new Date('2026-09-07T10:00:00Z'))).toBe(imported);
});
