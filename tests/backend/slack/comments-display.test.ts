import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { ProfileListItem } from '@/components/ui/ProfileListItem/ProfileListItem';
import { statusRows, validateExtraction } from '@/lib/slack/extraction';

// The backend test project compiles JSX in classic mode; Next compiles the actual UI.
beforeEach(() => {
  vi.stubGlobal('React', React);
});
afterEach(() => {
  vi.unstubAllGlobals();
});
function render(
  comment: string,
  endTime: string | null = null,
  endApproximate = false,
  status: 'IN_LATE' | 'LEAVING_EARLY' = 'IN_LATE'
) {
  const row = statusRows(
    validateExtraction(
      {
        decision: 'apply',
        reason: 'clear',
        intervals: [
          {
            status,
            fromDate: '2026-09-07',
            toDate: '2026-09-07',
            startTime: null,
            endTime,
            startApproximate: false,
            endApproximate,
            comment,
          },
        ],
      },
      new Date('2026-09-07T07:00:00Z'),
      `in later, ${comment}`
    )
  )[0];
  return renderToStaticMarkup(
    React.createElement(ProfileListItem, {
      showStatus: true,
      user: {
        userId: 'local-user',
        email: 'synthetic@example.com',
        firstName: 'Test',
        lastName: 'Person',
        status: {
          ...row,
          id: 1,
          userID: 'local-user',
          createdAt: '2026-09-07T07:00:00Z',
          announcedAt: new Date('2026-09-07T07:00:00Z'),
          sourceMessageKey: 'T:C:1788766200.000001',
        },
      },
    })
  );
}
describe('sender comment display', () => {
  it.each(['IN_LATE', 'LEAVING_EARLY'] as const)(
    'shows a comment without inventing a midnight action for %s',
    (status) => {
      const html = render('going to dentist', null, false, status);
      expect(html).toContain('going to dentist');
      expect(html).not.toContain('00:00');
      expect(html).not.toContain('>00.00<');
      expect(html).toContain('View Slack message');
    }
  );
  it('keeps approximate timing separate from comment wording', () => {
    const html = render('going to dentist', '10:00', true);
    expect(html).toContain('Until ca. 10:00');
    expect(html).toContain('going to dentist');
  });
  it('escapes sender-provided markup instead of rendering it', () => {
    const html = render('<script>alert("test")</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
