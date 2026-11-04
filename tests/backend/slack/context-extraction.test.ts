import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractAttendance, validateContextualExtraction } from '@/lib/slack/extraction';
import type { AttendanceContextEntry } from '@/lib/slack/attendance-context';

const sent = new Date('2026-09-07T07:30:00Z');
const prior: AttendanceContextEntry = {
  id: 'prior_1',
  messageSentAt: '2026-09-07T07:00:00.000Z',
  announcedAt: '2026-09-07T07:00:00.000Z',
  text: 'Coming tomorrow at 10',
  replaceable: true,
  intervals: [
    {
      status: 'IN_LATE',
      fromDate: '2026-09-08',
      toDate: '2026-09-08',
      startTime: null,
      endTime: '10:00',
      startApproximate: false,
      endApproximate: false,
    },
  ],
};
const correction = {
  decision: 'apply',
  reason: 'clear',
  replaces: ['prior_1'],
  intervals: [
    { ...prior.intervals[0], endTime: '11:00', comment: null },
    {
      ...prior.intervals[0],
      status: 'IN_OFFICE',
      startTime: '11:00',
      endTime: null,
      comment: null,
    },
  ],
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('contextual attendance extraction', () => {
  it('accepts a referenced arrival correction while retaining the prior target date', () => {
    expect(
      validateContextualExtraction(correction, sent, 'Actually make that 11', [prior])
    ).toMatchObject({ replaces: ['prior_1'], intervals: correction.intervals });
  });

  it.each([
    ['unknown reference', { ...correction, replaces: ['invented'] }, [prior]],
    ['duplicate reference', { ...correction, replaces: ['prior_1', 'prior_1'] }, [prior]],
    ['multi-day target', correction, [{ ...prior, replaceable: false }]],
    [
      'uncertain correction',
      { decision: 'review', reason: 'uncertain_time', intervals: [], replaces: ['prior_1'] },
      [prior],
    ],
  ])('rejects %s', (_name, output, context) => {
    expect(() =>
      validateContextualExtraction(
        output,
        sent,
        'Actually make that 11',
        context as AttendanceContextEntry[]
      )
    ).toThrow();
  });

  it('does not allow copying historical text into the new comment', () => {
    const output = {
      ...correction,
      intervals: [{ ...correction.intervals[0], comment: prior.text }],
    };
    expect(() =>
      validateContextualExtraction(output, sent, 'Actually make that 11', [prior])
    ).toThrow('Comment');
  });

  it('sends history as user data and bypasses bare-clock shorthand when context exists', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', 'synthetic-test-key');
    const request = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'context-test',
          choices: [
            {
              index: 0,
              finish_reason: 'stop',
              message: { role: 'assistant', content: JSON.stringify(correction) },
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
        }),
        { headers: { 'content-type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', request);
    const result = await extractAttendance('11:00', sent, undefined, [prior]);
    expect(result).toMatchObject(correction);
    expect(request).toHaveBeenCalledOnce();
    const body = JSON.parse(String((request.mock.calls[0][1] as RequestInit).body));
    const prompt = JSON.parse(
      body.messages.find((message: { role: string }) => message.role === 'user').content
    );
    expect(prompt).toEqual({
      messageSentAt: sent.toISOString(),
      localDate: '2026-09-07',
      message: '11:00',
      priorAnnouncements: [prior],
    });
    expect(
      body.messages.find((message: { role: string }) => message.role === 'system').content
    ).not.toContain(prior.text);
  });
});
