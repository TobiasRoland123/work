import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractAttendance, statusRows } from '@/lib/slack/extraction';

const sent = new Date('2026-09-06T23:30:00Z');
const interval = {
  status: 'FROM_HOME',
  fromDate: '2026-09-08',
  toDate: '2026-09-08',
  startTime: null,
  endTime: null,
  startApproximate: false,
  endApproximate: false,
  comment: null,
};
const output = { decision: 'apply', reason: 'clear', intervals: [interval] };
function reply(content: unknown = output, finish_reason = 'stop', refusal: string | null = null) {
  return new Response(
    JSON.stringify({
      choices: [
        {
          index: 0,
          finish_reason,
          message: {
            role: 'assistant',
            content: refusal ? null : JSON.stringify(content),
            refusal,
          },
        },
      ],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}
beforeEach(() => {
  vi.stubEnv('OPENAI_API_KEY', 'synthetic-test-key');
  vi.stubEnv('SLACK_EXTRACTION_MODEL', 'mock-model');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('attendance AI adapter with mocked structured replies', () => {
  it.each(['WFH tomorrow', 'Jeg arbejder hjemme i morgen'])(
    'anchors %s to original Copenhagen date and keeps identity outside the prompt',
    async (text) => {
      const request = vi.fn().mockResolvedValue(reply());
      vi.stubGlobal('fetch', request);
      const result = await extractAttendance(text, sent);
      expect(result.intervals[0].fromDate).toBe('2026-09-08');
      const payload = JSON.parse(request.mock.calls[0][1].body);
      expect(payload.store).toBe(false);
      expect(payload.response_format.json_schema.strict).toBe(true);
      expect(JSON.parse(payload.messages[1].content)).toEqual({
        messageSentAt: sent.toISOString(),
        localDate: '2026-09-07',
        message: text,
      });
      expect(payload.messages[0].content).toContain('untrusted');
    }
  );
  it.each([
    ['in later, going to dentist', 'going to dentist'],
    ['Tandlægebesøg først, så jeg kommer senere', 'Tandlægebesøg først'],
    ['going to dentist so I will be in later', 'going to dentist'],
  ])('extracts status and sender comment from %s through the SDK', async (text, comment) => {
    const request = vi
      .fn()
      .mockResolvedValue(
        reply({
          ...output,
          intervals: [
            {
              ...interval,
              status: 'IN_LATE',
              fromDate: '2026-09-07',
              toDate: '2026-09-07',
              comment,
            },
          ],
        })
      );
    vi.stubGlobal('fetch', request);
    const result = await extractAttendance(text, sent);
    expect(statusRows(result)[0]).toMatchObject({
      status: 'IN_LATE',
      details: comment,
      time: null,
      startsAtApproximate: false,
      endsAtApproximate: false,
    });
    const payload = JSON.parse(request.mock.calls[0][1].body);
    expect(payload.model).toBe('mock-model');
    expect(
      payload.response_format.json_schema.schema.properties.intervals.items.required
    ).toContain('comment');
    expect(payload.messages[0].content).toContain('semantic extraction, not a punctuation split');
  });
  it.each(['invented diagnosis', '', 'x'.repeat(2001)])(
    'rejects an invented, empty or oversized comment %#',
    async (comment) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(reply({ ...output, intervals: [{ ...interval, comment }] }))
      );
      expect(await extractAttendance('in later, going to dentist', sent)).toMatchObject({
        decision: 'review',
        intervals: [],
      });
    }
  );
  it('does not select a fallback model when runtime configuration is missing', async () => {
    vi.stubEnv('SLACK_EXTRACTION_MODEL', '');
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    await expect(extractAttendance('in later, going to dentist', sent)).rejects.toThrow(
      'AI configuration missing'
    );
    expect(request).not.toHaveBeenCalled();
  });
  it('retains a nominal approximate time from valid structured output', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        reply({
          ...output,
          intervals: [{ ...interval, status: 'IN_LATE', endTime: '10:00', endApproximate: true }],
        })
      )
    );
    const result = await extractAttendance('I morgen kommer jeg omkring kl. 10', sent);
    expect(result.intervals[0]).toMatchObject({
      status: 'IN_LATE',
      endTime: '10:00',
      endApproximate: true,
    });
  });
  it.each([
    { ...output, intervals: [{ ...interval, status: 'UNSUPPORTED' }] },
    { ...output, intervals: [{ ...interval, privateReason: 'private data' }] },
    { ...output, decision: 'ignore' },
    {
      ...output,
      intervals: [{ ...interval, status: 'IN_OFFICE', startTime: '10:00', startApproximate: true }],
    },
  ])('does not apply invalid or unsafe model output %#', async (unsafe) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(unsafe)));
    expect(await extractAttendance('Untrusted message content', sent)).toMatchObject({
      decision: 'review',
      intervals: [],
    });
  });
  it.each([
    ['length', null],
    ['stop', 'I cannot process this'],
  ] as const)('rejects incomplete or refused responses %#', async (finish, refusal) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(output, finish, refusal)));
    await expect(extractAttendance('WFH tomorrow', sent)).rejects.toThrow('Incomplete extraction');
  });
  it('leaves transport failures retryable instead of interpreting them as no status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 429 })));
    await expect(extractAttendance('WFH tomorrow', sent)).rejects.toMatchObject({
      statusCode: 429,
    });
  });
  it('maps explicit multi-day offsite work to AWAY without inventing a client or private reason', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        reply({
          ...output,
          intervals: [
            { ...interval, status: 'AWAY', fromDate: '2026-09-08', toDate: '2026-09-10' },
          ],
        })
      )
    );
    expect(
      (await extractAttendance('Working offsite Tuesday through Thursday', sent)).intervals[0]
    ).toMatchObject({ status: 'AWAY', fromDate: '2026-09-08', toDate: '2026-09-10' });
  });
});
