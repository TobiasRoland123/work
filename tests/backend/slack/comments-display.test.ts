import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { ProfileListItem } from '@/components/ui/ProfileListItem/ProfileListItem';
import { descriptionRows, statusRows, validateExtraction } from '@/lib/slack/extraction';

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

describe('unclassified attendance descriptions', () => {
  const sent = new Date('2026-09-07T22:30:00Z');
  const extraction = { decision: 'review', reason: 'uncertain_status', intervals: [] } as const;
  const message = '  My day is complicated\n<script>hello</script>  ';
  const rows = () => descriptionRows({ ...extraction, intervals: [] }, message, sent);

  it('preserves the full message and uses the original Copenhagen day', () => {
    expect(rows()).toEqual([
      expect.objectContaining({
        status: null,
        details: message,
        fromDate: '2026-09-08',
        toDate: '2026-09-08',
        startsAt: new Date('2026-09-07T22:00:00Z'),
        endsAt: new Date('2026-09-08T22:00:00Z'),
      }),
    ]);
  });

  it.each([
    'uncertain_date',
    'uncertain_time',
    'other_person',
    'conflicting',
    'unsupported',
  ] as const)('leaves %s in review', (reason) => {
    expect(descriptionRows({ decision: 'review', reason, intervals: [] }, message, sent)).toEqual(
      []
    );
  });

  it.each([
    'Playing VECTIDE: Ride the waveform rest of the day',
    'hello',
    'https://work-ivory-six.vercel.app/today',
  ])('displays a message even when the model calls it unrelated: %s', (message) => {
    expect(
      descriptionRows(
        { decision: 'ignore', reason: 'not_attendance', intervals: [] },
        message,
        sent
      )
    ).toEqual([expect.objectContaining({ status: null, details: message })]);
  });

  it('does not display empty messages', () => {
    expect(descriptionRows({ ...extraction, intervals: [] }, '  ', sent)).toEqual([]);
  });

  it('renders the message safely without a status badge or date badge', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProfileListItem, {
        showStatus: true,
        user: {
          userId: 'local-user',
          email: 'synthetic@example.com',
          firstName: 'Test',
          lastName: 'Person',
          status: {
            ...rows()[0],
            id: 1,
            userID: 'local-user',
            createdAt: sent.toISOString(),
            announcedAt: sent,
            sourceMessageKey: 'T:C:1788810600.000001',
          },
        },
      })
    );
    expect(html).toContain('&lt;script&gt;hello&lt;/script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('role="status"');
    expect(html).toContain('View Slack message');
  });
});
