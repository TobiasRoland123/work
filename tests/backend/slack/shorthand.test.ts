import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractAttendance } from '@/lib/slack/extraction';

// 07:26 in Copenhagen on the test date. This also verifies that "rest of day"
// uses the message's local clock rather than a processing-time clock.
const sent = new Date('2026-09-07T05:26:00Z');
const day = '2026-09-07';

function interval(overrides: Record<string, unknown> = {}) {
  return {
    status: 'FROM_HOME',
    fromDate: day,
    toDate: day,
    startTime: null,
    endTime: null,
    startApproximate: false,
    endApproximate: false,
    comment: null,
    ...overrides,
  };
}

function reply(content: unknown) {
  return new Response(
    JSON.stringify({
      choices: [
        {
          index: 0,
          finish_reason: 'stop',
          message: { role: 'assistant', content: JSON.stringify(content), refusal: null },
        },
      ],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}

beforeEach(() => {
  vi.stubEnv('AI_GATEWAY_API_KEY', '');
  vi.stubEnv('SLACK_EXTRACTION_MODEL', 'mock-model');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('common Slack shorthand', () => {
  it.each([
    ['wfh', interval()],
    ['  WFH  ', interval()],
    ['  :house:   WfH   (edited)  ', interval()],
    ['wfkk', interval({ status: 'AT_CLIENT', comment: 'wfkk' })],
    ['sick', interval({ status: 'SICK' })],
    ['still sick', interval({ status: 'SICK' })],
    ['child sick', interval({ status: 'CHILD_SICK' })],
    ['KMD Ballerup', interval({ status: 'AT_CLIENT', comment: 'KMD Ballerup' })],
  ])('resolves %s without an AI configuration', async (text, expected) => {
    const request = vi.fn();
    vi.stubGlobal('fetch', request);

    await expect(extractAttendance(text, sent)).resolves.toEqual({
      decision: 'apply',
      reason: 'clear',
      intervals: [expected],
    });
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    ['In at 7', '07:00'],
    ['In at 9', '09:00'],
    ['In at 10', '10:00'],
    ['In 9.45', '09:45'],
    ['in the office at 10.30', '10:30'],
  ])('turns %s into a late arrival and office start', async (text, time) => {
    const result = await extractAttendance(text, sent);
    if (time <= '09:00') {
      expect(result.intervals).toEqual([interval({ status: 'IN_OFFICE', startTime: time })]);
    } else {
      expect(result.intervals).toEqual([
        interval({ status: 'IN_LATE', endTime: time }),
        interval({ status: 'IN_OFFICE', startTime: time }),
      ]);
    }
    expect(result.decision).toBe('apply');
    expect(result.reason).toBe('clear');
  });

  it.each(['Wfh, In at 10:00', 'Starting from home, in at 10'])(
    'preserves the home-to-office transition in %s',
    async (text) => {
      expect((await extractAttendance(text, sent)).intervals).toEqual([
        interval({ endTime: '10:00' }),
        interval({ status: 'IN_OFFICE', startTime: '10:00' }),
      ]);
    }
  );

  it.each([
    'wfh tomorrow',
    'not wfh',
    'wfh with child sick',
    'wfh, hope to come in later',
    'in at 25:00',
    'wfh?',
  ])('sends the complete unsupported message %s to AI', async (text) => {
    vi.stubEnv('AI_GATEWAY_API_KEY', 'synthetic-test-key');
    const request = vi
      .fn()
      .mockResolvedValue(reply({ decision: 'review', reason: 'uncertain_status', intervals: [] }));
    vi.stubGlobal('fetch', request);
    await extractAttendance(text, sent);
    expect(request).toHaveBeenCalledOnce();
    const payload = JSON.parse(request.mock.calls[0][1].body);
    expect(JSON.parse(payload.messages[1].content).message).toBe(text);
  });

  it('uses the Copenhagen calendar day across UTC midnight', async () => {
    const result = await extractAttendance('wfh', new Date('2026-09-06T23:30:00Z'));
    expect(result.intervals[0].fromDate).toBe('2026-09-07');
  });

  it('maps lunch arrival to an approximate 11:00 late arrival', async () => {
    await expect(extractAttendance('in at lunch', sent)).resolves.toEqual({
      decision: 'apply',
      reason: 'clear',
      intervals: [interval({ status: 'IN_LATE', endTime: '11:00', endApproximate: true })],
    });
  });

  it.each(['starting at home, in before lunch', 'wfh, at the office after lunch'])(
    'keeps the before/after lunch qualification in the comment for %s',
    async (text) => {
      await expect(extractAttendance(text, sent)).resolves.toEqual({
        decision: 'apply',
        reason: 'clear',
        intervals: [
          interval({
            endTime: '11:00',
            endApproximate: true,
            comment: text,
          }),
        ],
      });
    }
  );

  it('anchors WFH rest of day to the original Copenhagen message time', async () => {
    await expect(extractAttendance('wfh rest of day', sent)).resolves.toEqual({
      decision: 'apply',
      reason: 'clear',
      intervals: [interval({ startTime: '07:26' })],
    });
  });

  it('leaves an unconfirmed bare clock for the AI fallback', async () => {
    const request = vi
      .fn()
      .mockResolvedValue(reply({ decision: 'review', reason: 'uncertain_status', intervals: [] }));
    vi.stubEnv('AI_GATEWAY_API_KEY', 'synthetic-test-key');
    vi.stubGlobal('fetch', request);

    await expect(extractAttendance('9:30', sent)).resolves.toMatchObject({
      decision: 'review',
      reason: 'uncertain_status',
      intervals: [],
    });
    expect(request).toHaveBeenCalledOnce();
  });

  it('gives the AI the same KommuneKredit and lunch shorthand rules', async () => {
    const request = vi.fn().mockResolvedValue(
      reply({
        decision: 'apply',
        reason: 'clear',
        intervals: [interval({ status: 'IN_LATE', comment: 'dentist appointment' })],
      })
    );
    vi.stubEnv('AI_GATEWAY_API_KEY', 'synthetic-test-key');
    vi.stubGlobal('fetch', request);

    await extractAttendance('dentist appointment, then I will be in later', sent);
    const payload = JSON.parse(request.mock.calls[0][1].body);
    expect(payload.messages[0].content).toContain('KommuneKredit');
    expect(payload.messages[0].content).toContain('11:00');
  });
});
