import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Status } from '@/components/ui/Status/Status';
import { ProfileListItem } from '@/components/ui/ProfileListItem/ProfileListItem';
import type { Status as StatusRow } from '@/db/types';

beforeEach(() => vi.stubGlobal('React', React));
afterEach(() => vi.unstubAllGlobals());

describe('AI attribution', () => {
  it.each([true, false])('labels imported statuses when asLabel is %s', (asLabel) => {
    const html = renderToStaticMarkup(
      React.createElement(Status, { status: 'FROM_HOME', sourceMessageKey: 'T:C:123', asLabel })
    );
    expect(html).toContain('From home');
    expect(html).toContain('aria-label="AI-assisted"');
    expect(html).toContain('title="AI-assisted Slack import"');
    expect(html).toContain('lucide-sparkles');
    expect(html).not.toContain('>AI</span>');
    expect(html).toContain(`data-ai-indicator="${asLabel ? 'corner' : 'inline'}"`);
  });

  it.each([null, undefined])(
    'does not mark manually selected statuses with source %s',
    (sourceMessageKey) => {
      const html = renderToStaticMarkup(
        React.createElement(Status, { status: 'FROM_HOME', sourceMessageKey })
      );
      expect(html).toContain('From home');
      expect(html).not.toContain('AI-assisted');
    }
  );

  it.each(['FROM_HOME', 'IN_OFFICE', null] as const)(
    'shows one indicator for an imported %s profile announcement, rather than repeating it on dates',
    (status) => {
      const row: StatusRow = {
        id: 1,
        userID: 'anna',
        status,
        details: 'Slack announcement',
        emoji: null,
        time: null,
        fromDate: '2026-09-21',
        toDate: '2026-09-22',
        startsAt: null,
        endsAt: null,
        startsAtApproximate: false,
        endsAtApproximate: false,
        createdAt: '2026-09-20T07:00:00Z',
        announcedAt: new Date('2026-09-20T07:00:00Z'),
        sourceMessageKey: 'T:C:123',
      };
      const html = renderToStaticMarkup(
        React.createElement(ProfileListItem, {
          showStatus: true,
          user: { userId: 'anna', email: 'anna@example.com', status: row },
        })
      );
      expect(html.match(/aria-label="AI-assisted"/g)).toHaveLength(1);
    }
  );
});
