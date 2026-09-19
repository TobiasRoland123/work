import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { PeoplePanel } from '@/components/office/PeoplePanel';
import type { UserWithExtras } from '@/db/types';

beforeEach(() => {
  vi.stubGlobal('React', React);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PeoplePanel status date display', () => {
  it('renders multi-day date badge beside status in the person row without year', () => {
    const profiles: UserWithExtras[] = [
      {
        id: 1,
        userId: 'user-anna',
        email: 'anna@sandbox.local',
        firstName: 'Anna',
        lastName: 'Attendee',
        systemRole: 'USER',
        organisationId: 1,
        organisation: 'Test Org',
        createdAt: '2026-09-01T00:00:00Z',
        profilePicture: null,
        organisationRoles: [],
        status: {
          id: 1,
          userID: 'user-anna',
          status: 'AWAY',
          details: 'at conference',
          time: null,
          fromDate: '2026-09-19',
          toDate: '2026-09-20',
          startsAt: new Date('2026-09-18T22:00:00Z'),
          endsAt: new Date('2026-09-20T22:00:00Z'),
          startsAtApproximate: false,
          endsAtApproximate: false,
          createdAt: '2026-09-19T07:00:00Z',
          announcedAt: new Date('2026-09-19T07:00:00Z'),
          sourceMessageKey: 'T:C:1788810600.000001',
        },
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(PeoplePanel, {
        profiles,
        selectedId: null,
        onSelect: () => {},
      })
    );

    expect(html).toContain('Anna Attendee');
    expect(html).toContain('Temporarily away');
    expect(html).toContain('19.09-20.09');
    expect(html).not.toContain('19.09.2026');
  });

  it('does not render date badge when fromDate and toDate are the same or single day', () => {
    const profiles: UserWithExtras[] = [
      {
        id: 2,
        userId: 'user-mads',
        email: 'mads@sandbox.local',
        firstName: 'Mads',
        lastName: 'Madsen',
        systemRole: 'USER',
        organisationId: 1,
        organisation: 'Test Org',
        createdAt: '2026-09-01T00:00:00Z',
        profilePicture: null,
        organisationRoles: [],
        status: {
          id: 2,
          userID: 'user-mads',
          status: 'IN_OFFICE',
          details: null,
          time: null,
          fromDate: '2026-09-19',
          toDate: '2026-09-19',
          startsAt: new Date('2026-09-18T22:00:00Z'),
          endsAt: new Date('2026-09-19T22:00:00Z'),
          startsAtApproximate: false,
          endsAtApproximate: false,
          createdAt: '2026-09-19T07:00:00Z',
          announcedAt: new Date('2026-09-19T07:00:00Z'),
          sourceMessageKey: null,
        },
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(PeoplePanel, {
        profiles,
        selectedId: null,
        onSelect: () => {},
      })
    );

    expect(html).toContain('Mads Madsen');
    expect(html).toContain('In office');
    expect(html).not.toContain('19.09-19.09');
  });
});
