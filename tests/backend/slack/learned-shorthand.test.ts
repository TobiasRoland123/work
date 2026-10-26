import { describe, expect, it } from 'vitest';
import {
  extractionFromTemplate,
  learningPhrase,
  learningThreshold,
  templateFromExtraction,
} from '@/lib/slack/learned-shorthand';
import type { Extraction } from '@/lib/slack/extraction';

// Monday 2026-09-07 at 07:26 in Copenhagen.
const sent = new Date('2026-09-07T05:26:00Z');

function interval(overrides: Partial<Extraction['intervals'][number]> = {}) {
  return {
    status: 'AT_CLIENT' as const,
    fromDate: '2026-09-07',
    toDate: '2026-09-07',
    startTime: null,
    endTime: null,
    startApproximate: false,
    endApproximate: false,
    comment: null,
    ...overrides,
  };
}
const apply = (...intervals: Extraction['intervals']): Extraction => ({
  decision: 'apply',
  reason: 'clear',
  intervals,
});

describe('learningPhrase', () => {
  it('normalizes the whole message', () => {
    expect(learningPhrase('  Hos Kunden I Dag.  (edited) ', sent)).toBe('hos kunden i dag');
    expect(learningPhrase('At the client today and tomorrow!', sent)).toBe(
      'at the client today and tomorrow'
    );
  });
  it('leaves phrases the fixed parser handles to that parser', () => {
    expect(learningPhrase('wfh', sent)).toBeNull();
    expect(learningPhrase('in at 10', sent)).toBeNull();
  });
  it.each([
    ['a weekday', 'home friday'],
    ['a Danish weekday', 'hjemme på fredag'],
    ['a month', 'vacation in july'],
    ['a week', 'hjemme resten af ugen'],
    ['a numeric date', 'wfh 24/12'],
    ['a Danish date', 'ferie d. 14'],
    ['the moment of sending', 'leaving now'],
    ['negation', 'not in the office'],
    ['Danish negation', 'ikke på kontoret'],
    ['a contraction', "won't make it in"],
    ['a question', 'office today?'],
    ['a long message', 'at the client '.repeat(10)],
  ])('does not learn a phrase with %s', (_, text) => {
    expect(learningPhrase(text, sent)).toBeNull();
  });
});

describe('learned templates', () => {
  it('stores days relative to the message and resolves them from each new message', () => {
    const template = templateFromExtraction(
      apply(interval({ toDate: '2026-09-08', comment: 'Hos  Kunden' })),
      sent
    );
    expect(template).toEqual({
      intervals: [
        {
          status: 'AT_CLIENT',
          fromOffset: 0,
          toOffset: 1,
          startTime: null,
          endTime: null,
          startApproximate: false,
          endApproximate: false,
          comment: 'hos kunden',
        },
      ],
    });
    // Sent late on 30 September in Copenhagen, which is already 1 October in some zones.
    const later = new Date('2026-09-30T21:30:00Z');
    expect(extractionFromTemplate(template!, 'HOS KUNDEN i dag og i morgen', later)).toEqual(
      apply(
        interval({
          fromDate: '2026-09-30',
          toDate: '2026-10-01',
          comment: 'HOS KUNDEN i dag og i morgen',
        })
      )
    );
  });
  it('round trips the complete learned source message as its comment', () => {
    const message = 'In Aarhus for a meeting with Daniel. See you tomorrow.';
    const template = templateFromExtraction(apply(interval({ comment: message })), sent)!;
    expect(template.intervals[0].comment).toBe(message.toLowerCase());
    expect(extractionFromTemplate(template, message, sent)?.intervals[0].comment).toBe(message);
  });
  it('keeps clocks across a daylight saving change', () => {
    const template = templateFromExtraction(
      apply(
        interval({ status: 'IN_LATE', endTime: '10:00' }),
        interval({ status: 'IN_OFFICE', startTime: '10:00' })
      ),
      sent
    );
    // Sunday 25 October 2026 is the change to winter time.
    const result = extractionFromTemplate(
      template!,
      'in around ten',
      new Date('2026-10-25T06:00:00Z')
    );
    expect(result?.intervals.map((i) => [i.fromDate, i.startTime, i.endTime])).toEqual([
      ['2026-10-25', null, '10:00'],
      ['2026-10-25', '10:00', null],
    ]);
  });
  it('does not learn a clock read from the moment of sending', () => {
    expect(
      templateFromExtraction(apply(interval({ status: 'FROM_HOME', startTime: '07:26' })), sent)
    ).toBeNull();
    expect(
      templateFromExtraction(
        { decision: 'review', reason: 'uncertain_status', intervals: [] },
        sent
      )
    ).toBeNull();
  });
  it('falls through when the comment is not in the new message or the result is invalid', () => {
    const template = templateFromExtraction(apply(interval({ comment: 'hos kunden' })), sent)!;
    expect(extractionFromTemplate(template, 'hos kunde i dag', sent)).toBeNull();
    const gap = templateFromExtraction(
      apply(interval({ status: 'IN_OFFICE', startTime: '02:30' })),
      sent
    )!;
    // 02:30 does not exist on the day summer time starts.
    expect(extractionFromTemplate(gap, 'early start', new Date('2026-03-29T08:00:00Z'))).toBeNull();
  });
});

describe('learningThreshold', () => {
  it.each([
    [undefined, null],
    ['', null],
    ['0', null],
    ['2.5', null],
    ['three', null],
    ['1', 1],
    [' 4 ', 4],
  ])('reads %j as %j', (value, expected) => {
    expect(learningThreshold({ ...process.env, SLACK_SHORTHAND_LEARNING_THRESHOLD: value })).toBe(
      expected
    );
  });
});
