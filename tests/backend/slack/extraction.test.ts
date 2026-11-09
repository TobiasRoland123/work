import { describe, expect, it, vi } from 'vitest';
import {
  AI_GATEWAY_BASE_URL,
  DEFAULT_SLACK_EXTRACTION_MODEL,
  copenhagenDate,
  extractAttendance,
  localInstant,
  statusRows,
  slackMentionIds,
  validateExtraction,
} from '@/lib/slack/extraction';
import { isStatusApplicable } from '@/lib/status/active';

const sent = new Date('2026-09-07T07:30:00Z');
const interval: {
  status: string;
  fromDate: string;
  toDate: string;
  startTime: string | null;
  endTime: string | null;
  startApproximate: boolean;
  endApproximate: boolean;
  comment: string | null;
} = {
  status: 'FROM_HOME',
  fromDate: '2026-09-07',
  toDate: '2026-09-07',
  startTime: null,
  endTime: null,
  startApproximate: false,
  endApproximate: false,
  comment: null,
};
const extract = (intervals = [interval]) => ({ decision: 'apply', reason: 'clear', intervals });

describe('attendance extraction boundary', () => {
  it('accepts only explicit Slack mentions and deduplicates shared attendance recipients', () => {
    const message =
      'Going to Dagrofa logistik in Vejle for the day together with <@U08KPFPT928>, <@U585BUWS2> and Martin Rose';
    expect(slackMentionIds(message)).toEqual(['U08KPFPT928', 'U585BUWS2']);
    const result = validateExtraction(
      {
        ...extract(),
        intervals: [
          {
            ...interval,
            status: 'AT_CLIENT',
            comment: message,
            mentionedUserIds: ['U08KPFPT928', 'U585BUWS2', 'U08KPFPT928'],
          },
        ],
      },
      sent,
      message
    );
    expect(result.intervals[0].mentionedUserIds).toEqual(['U08KPFPT928', 'U585BUWS2']);
    expect(result.intervals[0].comment).toBe(message);
    expect(() =>
      validateExtraction(
        { ...extract(), intervals: [{ ...interval, mentionedUserIds: ['UINVENTED'] }] },
        sent,
        message
      )
    ).toThrow('explicitly mentioned');
  });
  it('keeps recipient assignments on their own intervals and preserves old extraction input', () => {
    expect(validateExtraction(extract(), sent).intervals[0].mentionedUserIds).toBeUndefined();
    const result = validateExtraction(
      {
        ...extract(),
        intervals: [
          { ...interval, endTime: '12:00', mentionedUserIds: ['U123'] },
          { ...interval, status: 'IN_OFFICE', startTime: '12:00', mentionedUserIds: [] },
        ],
      },
      sent,
      'WFH with <@U123> until noon, then I return to the office'
    );
    expect(result.intervals.map((row) => row.mentionedUserIds)).toEqual([['U123'], []]);
  });
  it('uses Copenhagen day across UTC midnight', () => {
    expect(copenhagenDate(new Date('2026-09-06T23:30:00Z'))).toBe('2026-09-07');
  });
  it('represents WFH dates without manufacturing action times or retaining reasons', () => {
    const [row] = statusRows(validateExtraction(extract(), sent));
    expect(row.time).toBeNull();
    expect(row.details).toBeNull();
    expect(row.startsAt.toISOString()).toBe('2026-09-06T22:00:00.000Z');
    expect(row.endsAt.toISOString()).toBe('2026-09-07T22:00:00.000Z');
  });
  it('keeps multi-day final dates inclusive through the last evening', () => {
    const [row] = statusRows(
      validateExtraction(extract([{ ...interval, toDate: '2026-09-11' }]), sent)
    );
    expect(row.endsAt.toISOString()).toBe('2026-09-11T22:00:00.000Z');
  });
  it('supports precise arrival, departure and return intervals', () => {
    const parsed = validateExtraction(
      extract([
        { ...interval, status: 'IN_LATE', endTime: '10:00' } as typeof interval,
        {
          ...interval,
          status: 'IN_OFFICE',
          startTime: '10:00',
          endTime: '13:00',
        } as typeof interval,
        { ...interval, status: 'AWAY', startTime: '13:00', endTime: '14:00' } as typeof interval,
        { ...interval, status: 'IN_OFFICE', startTime: '14:00' } as typeof interval,
      ]),
      sent
    );
    const rows = statusRows(parsed);
    expect(rows[0].endsAt.toISOString()).toBe('2026-09-07T08:00:00.000Z');
    expect(
      rows.map((row) => [row.status, row.startsAt.toISOString(), row.endsAt.toISOString()])
    ).toEqual([
      ['IN_LATE', '2026-09-06T22:00:00.000Z', '2026-09-07T08:00:00.000Z'],
      ['IN_OFFICE', '2026-09-07T08:00:00.000Z', '2026-09-07T11:00:00.000Z'],
      ['AWAY', '2026-09-07T11:00:00.000Z', '2026-09-07T12:00:00.000Z'],
      ['IN_OFFICE', '2026-09-07T12:00:00.000Z', '2026-09-07T22:00:00.000Z'],
    ]);
  });
  it('preserves unspecified arrival time', () => {
    const [row] = statusRows(
      validateExtraction(extract([{ ...interval, status: 'IN_LATE' }]), sent)
    );
    expect(row.time).toBeNull();
    expect(row.details).toBe('Arrival time unspecified');
  });
  it.each([
    ['nonexistent calendar date', { ...interval, fromDate: '2026-02-30' }],
    ['reversed dates', { ...interval, toDate: '2026-09-06' }],
    ['reversed clocks', { ...interval, startTime: '14:00', endTime: '13:00' }],
    ['invalid clock', { ...interval, startTime: '25:00' }],
    [
      'date beyond the supported horizon',
      { ...interval, fromDate: '2028-01-01', toDate: '2028-01-02' },
    ],
    ['clock on a multi-day interval', { ...interval, toDate: '2026-09-08', startTime: '14:00' }],
  ])('rejects %s', (_, bad) => {
    expect(() => validateExtraction(extract([bad as typeof interval]), sent)).toThrow();
  });
  it('rejects invented free-text fields and overlapping intervals', () => {
    expect(() =>
      validateExtraction(
        extract([{ ...interval, reason: 'private diagnosis' } as typeof interval]),
        sent
      )
    ).toThrow();
    expect(() => validateExtraction(extract([interval, interval]), sent)).toThrow();
  });
  it('uses the complete original message for every non-null comment and preserves null comments', () => {
    const message = '  In Aarhus for a meeting with Daniel. See you tomorrow. 👋\n  ';
    const parsed = validateExtraction(
      extract([
        { ...interval, status: 'AT_CLIENT', comment: 'In Aarhus for a meeting' },
        { ...interval, status: 'IN_OFFICE', fromDate: '2026-09-08', toDate: '2026-09-08' },
      ]),
      sent,
      message
    );
    expect(parsed.intervals.map(({ comment }) => comment)).toEqual([message, null]);
  });
  it('accepts a full comment up to 12000 characters and rejects longer comments', () => {
    const comment = 'x'.repeat(12000);
    const oversizedMessage = `valid excerpt${'x'.repeat(12001 - 'valid excerpt'.length)}`;
    expect(
      validateExtraction(extract([{ ...interval, comment }]), sent, comment).intervals[0].comment
    ).toBe(comment);
    expect(() =>
      validateExtraction(
        extract([{ ...interval, comment: 'valid excerpt' }]),
        sent,
        oversizedMessage
      )
    ).toThrow();
    expect(() =>
      validateExtraction(extract([{ ...interval, comment: 'x'.repeat(12001) }]), sent, comment)
    ).toThrow();
  });
  it('cannot apply uncertain output', () => {
    expect(() => validateExtraction({ ...extract(), decision: 'review' }, sent)).toThrow();
    expect(
      validateExtraction({ decision: 'review', reason: 'uncertain_date', intervals: [] }, sent)
        .intervals
    ).toEqual([]);
  });
  it('rejects repeated/nonexistent Danish daylight-saving clock times', () => {
    expect(() => localInstant('2026-03-29', '02:30')).toThrow();
    expect(() => localInstant('2026-10-25', '02:30')).toThrow();
    expect(localInstant('2026-03-29', '03:30').toISOString()).toBe('2026-03-29T01:30:00.000Z');
  });
});

it('preserves approximate nominal arrival without turning it into definite office presence', () => {
  const parsed = validateExtraction(
    extract([
      { ...interval, status: 'IN_LATE', endTime: '10:00', endApproximate: true } as typeof interval,
    ]),
    sent
  );
  const [row] = statusRows(parsed);
  expect(row.endsAtApproximate).toBe(true);
  expect(row.endsAt.toISOString()).toBe('2026-09-07T08:00:00.000Z');
  expect(() =>
    validateExtraction(
      extract([
        {
          ...interval,
          status: 'IN_OFFICE',
          startTime: '10:00',
          startApproximate: true,
        } as typeof interval,
      ]),
      sent
    )
  ).toThrow();
});

describe('multi-day out-of-office status extraction', () => {
  it('maps multi-day date intervals with statusRows covering today through tomorrow inclusive', () => {
    const awayInterval = {
      ...interval,
      status: 'AWAY',
      fromDate: '2026-09-07',
      toDate: '2026-09-08',
      comment: 'at conference today and tomorrow',
    };
    const parsed = validateExtraction(
      extract([awayInterval]),
      sent,
      'at conference today and tomorrow'
    );
    const [row] = statusRows(parsed);
    expect(row.status).toBe('AWAY');
    expect(row.fromDate).toBe('2026-09-07');
    expect(row.toDate).toBe('2026-09-08');
    expect(row.details).toBe('at conference today and tomorrow');
    expect(row.startsAt.toISOString()).toBe('2026-09-06T22:00:00.000Z');
    expect(row.endsAt.toISOString()).toBe('2026-09-08T22:00:00.000Z');

    // Both today and tomorrow reflect the active status in the application
    const status = {
      ...row,
      createdAt: '2026-09-07T07:00:00Z',
      announcedAt: new Date('2026-09-07T07:00:00Z'),
    };
    expect(isStatusApplicable(status, new Date('2026-09-07T12:00:00Z'))).toBe(true);
    expect(isStatusApplicable(status, new Date('2026-09-08T12:00:00Z'))).toBe(true);
    expect(isStatusApplicable(status, new Date('2026-09-09T12:00:00Z'))).toBe(false);
  });

  it('maps multi-day REMOTE intervals with statusRows and details preserved', () => {
    const remoteInterval = {
      ...interval,
      status: 'REMOTE',
      fromDate: '2026-09-07',
      toDate: '2026-09-08',
      comment: 'Working from Roskilde today and tomorrow',
    };
    const parsed = validateExtraction(
      extract([remoteInterval]),
      sent,
      'Working from Roskilde today and tomorrow'
    );
    const [row] = statusRows(parsed);
    expect(row.status).toBe('REMOTE');
    expect(row.fromDate).toBe('2026-09-07');
    expect(row.toDate).toBe('2026-09-08');
    expect(row.details).toBe('Working from Roskilde today and tomorrow');
    expect(row.startsAt.toISOString()).toBe('2026-09-06T22:00:00.000Z');
    expect(row.endsAt.toISOString()).toBe('2026-09-08T22:00:00.000Z');
  });
});

describe('AI Gateway transport', () => {
  it('does not create an AI attempt for deterministic shorthand', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', '');
    const usageObserver = { onStart: vi.fn(), onFinish: vi.fn() };
    try {
      await expect(extractAttendance('wfh', sent, usageObserver)).resolves.toMatchObject({
        decision: 'apply',
        reason: 'clear',
      });
      expect(usageObserver.onStart).not.toHaveBeenCalled();
      expect(usageObserver.onFinish).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('uses the Gateway URL, bearer key, provider-qualified default model, and disables storage', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', 'gateway-test-key');
    vi.stubEnv('SLACK_EXTRACTION_MODEL', '');
    const request = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              index: 0,
              finish_reason: 'stop',
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  decision: 'ignore',
                  reason: 'not_attendance',
                  intervals: [],
                }),
              },
            },
          ],
          id: 'gen_123',
          generationId: 'gen_123',
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
            cost: 0.000008,
          },
        }),
        { headers: { 'content-type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', request);
    const usageObserver = { onStart: vi.fn(), onFinish: vi.fn() };

    try {
      await expect(extractAttendance('hello', sent, usageObserver)).resolves.toEqual({
        decision: 'ignore',
        reason: 'not_attendance',
        intervals: [],
      });
      expect(usageObserver.onStart).toHaveBeenCalledOnce();
      expect(usageObserver.onStart).toHaveBeenCalledWith(DEFAULT_SLACK_EXTRACTION_MODEL);
      expect(usageObserver.onFinish).toHaveBeenCalledOnce();
      expect(usageObserver.onFinish).toHaveBeenCalledWith({
        state: 'completed',
        costUsd: '0.000008',
        inputTokens: 10,
        outputTokens: 5,
        responseId: 'gen_123',
      });
      expect(request).toHaveBeenCalledOnce();
      const [input, init] = request.mock.calls[0] as [RequestInfo | URL, RequestInit];
      expect(String(input)).toBe(`${AI_GATEWAY_BASE_URL}/chat/completions`);
      expect(new Headers(init.headers).get('authorization')).toBe('Bearer gateway-test-key');
      const body = JSON.parse(String(init.body));
      expect(body.response_format.json_schema.schema.properties.intervals.items.required).toContain(
        'mentionedUserIds'
      );
      expect(body.model).toBe(DEFAULT_SLACK_EXTRACTION_MODEL);
      expect(body.store).toBe(false);
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });

  it('fails clearly when the Gateway key is missing', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', '');
    try {
      await expect(extractAttendance('hello', sent)).rejects.toThrow(
        'AI Gateway configuration missing: AI_GATEWAY_API_KEY'
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('records a failed model call without estimating its cost', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', 'gateway-test-key');
    const request = vi.fn().mockRejectedValue(new Error('connection closed'));
    vi.stubGlobal('fetch', request);
    const usageObserver = { onStart: vi.fn(), onFinish: vi.fn() };
    try {
      await expect(extractAttendance('hello', sent, usageObserver)).rejects.toThrow(
        'connection closed'
      );
      expect(request).toHaveBeenCalledOnce();
      expect(usageObserver.onStart).toHaveBeenCalledOnce();
      expect(usageObserver.onFinish).toHaveBeenCalledExactlyOnceWith({
        state: 'failed',
        costUsd: null,
        inputTokens: null,
        outputTokens: null,
        responseId: null,
      });
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
});

describe('extraction intake and clock boundaries', () => {
  it.each([
    ['2026-08-07', true],
    ['2026-08-06', false],
    ['2027-09-08', true],
    ['2027-09-09', false],
  ])('bounds supported dates at %s', (date, accepted) => {
    const input = extract([{ ...interval, fromDate: date, toDate: date }]);
    if (accepted)
      expect(validateExtraction(input, sent).intervals).toEqual([
        { ...interval, fromDate: date, toDate: date },
      ]);
    else expect(() => validateExtraction(input, sent)).toThrow('outside supported range');
  });
  it.each([
    { startApproximate: true },
    { endApproximate: true },
    { startTime: '12:00', endTime: '12:00' },
  ])('rejects missing approximate clocks or zero duration %#', (overrides) => {
    expect(() => validateExtraction(extract([{ ...interval, ...overrides }]), sent)).toThrow();
  });
  it('returns oversized input to review without calling the model or recording paid usage', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const observer = { onStart: vi.fn(), onFinish: vi.fn() };
    try {
      await expect(extractAttendance('x'.repeat(12001), sent, observer)).resolves.toEqual({
        decision: 'review',
        reason: 'unsupported',
        intervals: [],
      });
      expect(fetch).not.toHaveBeenCalled();
      expect(observer.onStart).not.toHaveBeenCalled();
      expect(observer.onFinish).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('does not call the model if storing the attempt fails', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', 'synthetic-key');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const observer = {
      onStart: vi.fn().mockRejectedValue(new Error('usage storage offline')),
      onFinish: vi.fn(),
    };
    try {
      await expect(extractAttendance('hello', sent, observer)).rejects.toThrow(
        'usage storage offline'
      );
      expect(fetch).not.toHaveBeenCalled();
      expect(observer.onFinish).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    }
  });
  it.each([
    ['2026-03-29', '2026-03-28T23:00:00.000Z', '2026-03-29T22:00:00.000Z'],
    ['2026-10-25', '2026-10-24T22:00:00.000Z', '2026-10-25T23:00:00.000Z'],
  ])('uses the full Copenhagen calendar day on DST transition %s', (date, start, end) => {
    const [row] = statusRows(
      validateExtraction(
        extract([{ ...interval, fromDate: date, toDate: date }]),
        new Date(`${date}T12:00:00Z`)
      )
    );
    expect(row.startsAt.toISOString()).toBe(start);
    expect(row.endsAt.toISOString()).toBe(end);
  });
});
