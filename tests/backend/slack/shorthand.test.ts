import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractAttendance, statusRows } from '@/lib/slack/extraction';
import { KMD_OFFICES } from '@/lib/slack/shorthand';

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
  it('defines the verified KMD office cities and aliases', () => {
    expect(KMD_OFFICES).toEqual([
      { city: 'Ballerup', office: 'KMD Ballerup', aliases: ['ballerup'] },
      { city: 'Odense', office: 'KMD Odense', aliases: ['odense'] },
      { city: 'Aalborg', office: 'KMD Aalborg', aliases: ['aalborg', 'ålborg'] },
      { city: 'Aarhus', office: 'KMD Aarhus', aliases: ['aarhus', 'århus'] },
      { city: 'Warszawa', office: 'KMD Warszawa', aliases: ['warszawa', 'warsaw'] },
    ]);
  });

  it.each([
    ['wfh', interval()],
    ['  WFH  ', interval()],
    ['  :house:   WfH   (edited)  ', interval()],
    ['wfkk', interval({ status: 'AT_CLIENT', comment: 'wfkk' })],
    ['sick', interval({ status: 'SICK' })],
    ['still sick', interval({ status: 'SICK' })],
    ['child sick', interval({ status: 'CHILD_SICK' })],
    ['KMD Ballerup', interval({ status: 'AT_CLIENT', comment: 'KMD Ballerup' })],
    ['KMD Odense', interval({ status: 'AT_CLIENT', comment: 'KMD Odense' })],
    ['KMD Aalborg', interval({ status: 'AT_CLIENT', comment: 'KMD Aalborg' })],
    ['KMD Aarhus', interval({ status: 'AT_CLIENT', comment: 'KMD Aarhus' })],
    ['KMD Århus', interval({ status: 'AT_CLIENT', comment: 'KMD Århus' })],
    ['KMD Warszawa', interval({ status: 'AT_CLIENT', comment: 'KMD Warszawa' })],
    ['KMD Warsaw', interval({ status: 'AT_CLIENT', comment: 'KMD Warsaw' })],
    ['Ballerup', interval({ status: 'AT_CLIENT', comment: 'Ballerup' })],
    ['Odense', interval({ status: 'AT_CLIENT', comment: 'Odense' })],
    ['Aalborg', interval({ status: 'AT_CLIENT', comment: 'Aalborg' })],
    ['Ålborg', interval({ status: 'AT_CLIENT', comment: 'Ålborg' })],
    ['Aarhus', interval({ status: 'AT_CLIENT', comment: 'Aarhus' })],
    ['Århus', interval({ status: 'AT_CLIENT', comment: 'Århus' })],
    ['Warszawa', interval({ status: 'AT_CLIENT', comment: 'Warszawa' })],
    ['Warsaw', interval({ status: 'AT_CLIENT', comment: 'Warsaw' })],
    ['at conference', interval({ status: 'AWAY', comment: 'at conference' })],
    ['på konference', interval({ status: 'AWAY', comment: 'på konference' })],
    ['til konference', interval({ status: 'AWAY', comment: 'til konference' })],
    ['offsite', interval({ status: 'AWAY', comment: 'offsite' })],
    ['remote', interval({ status: 'REMOTE' })],
    ['working remotely', interval({ status: 'REMOTE' })],
    ['working remote today', interval({ status: 'REMOTE' })],
    ['arbejder remote i dag', interval({ status: 'REMOTE' })],
    [
      'Working remotely today, not from home',
      interval({ status: 'REMOTE', comment: 'Working remotely today, not from home' }),
    ],
    [
      'Working from Roskilde today',
      interval({ status: 'REMOTE', comment: 'Working from Roskilde today' }),
    ],
    ['WF KMD Aalborg ✈️', interval({ status: 'AT_CLIENT', comment: 'WF KMD Aalborg ✈️' })],
    [
      'Working from Aalborg today',
      interval({ status: 'AT_CLIENT', comment: 'Working from Aalborg today' }),
    ],
    ['In Aalborg today', interval({ status: 'AT_CLIENT', comment: 'In Aalborg today' })],
    ['I Århus i dag', interval({ status: 'AT_CLIENT', comment: 'I Århus i dag' })],
    ['Working in Warsaw today', interval({ status: 'AT_CLIENT', comment: 'Working in Warsaw today' })],
    ['Working from home today', interval({ status: 'FROM_HOME' })],
    [
      'Working from home in Aalborg',
      interval({ status: 'FROM_HOME', comment: 'Working from home in Aalborg' }),
    ],
    [
      'WFH in Aarhus today',
      interval({ status: 'FROM_HOME', comment: 'WFH in Aarhus today' }),
    ],
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
    [
      'working remotely today and tomorrow',
      interval({
        status: 'REMOTE',
        toDate: '2026-09-08',
      }),
    ],
    [
      'working remote today and tomorow',
      interval({
        status: 'REMOTE',
        toDate: '2026-09-08',
      }),
    ],
    [
      'arbejder remote i dag og i morgen',
      interval({
        status: 'REMOTE',
        toDate: '2026-09-08',
      }),
    ],
    [
      'Working from Roskilde today and tomorrow',
      interval({
        status: 'REMOTE',
        toDate: '2026-09-08',
        comment: 'Working from Roskilde today and tomorrow',
      }),
    ],
    [
      'working remotely tomorrow',
      interval({
        status: 'REMOTE',
        fromDate: '2026-09-08',
        toDate: '2026-09-08',
      }),
    ],
  ])('resolves remote pattern "%s" without an AI configuration', async (text, expected) => {
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
    [
      'In Ballerup tomorrow',
      interval({
        status: 'AT_CLIENT',
        fromDate: '2026-09-08',
        toDate: '2026-09-08',
        comment: 'In Ballerup tomorrow',
      }),
    ],
    [
      'In Odense tomorrow',
      interval({
        status: 'AT_CLIENT',
        fromDate: '2026-09-08',
        toDate: '2026-09-08',
        comment: 'In Odense tomorrow',
      }),
    ],
    [
      'Working from Aarhus tomorrow',
      interval({
        status: 'AT_CLIENT',
        fromDate: '2026-09-08',
        toDate: '2026-09-08',
        comment: 'Working from Aarhus tomorrow',
      }),
    ],
    [
      'In Århus today and tomorrow',
      interval({
        status: 'AT_CLIENT',
        toDate: '2026-09-08',
        comment: 'In Århus today and tomorrow',
      }),
    ],
    [
      'KMD Warszawa today and tomorrow',
      interval({
        status: 'AT_CLIENT',
        toDate: '2026-09-08',
        comment: 'KMD Warszawa today and tomorrow',
      }),
    ],
    [
      'Working from Warsaw tomorrow',
      interval({
        status: 'AT_CLIENT',
        fromDate: '2026-09-08',
        toDate: '2026-09-08',
        comment: 'Working from Warsaw tomorrow',
      }),
    ],
    [
      'I Odense i dag og i morgen',
      interval({
        status: 'AT_CLIENT',
        toDate: '2026-09-08',
        comment: 'I Odense i dag og i morgen',
      }),
    ],
  ])(
    'resolves KMD office/city pattern "%s" to AT_CLIENT with preserved details',
    async (text, expected) => {
      const request = vi.fn();
      vi.stubGlobal('fetch', request);

      const extraction = await extractAttendance(text, sent);
      expect(extraction).toEqual({
        decision: 'apply',
        reason: 'clear',
        intervals: [expected],
      });
      expect(statusRows(extraction)[0]).toMatchObject({
        status: 'AT_CLIENT',
        fromDate: expected.fromDate,
        toDate: expected.toDate,
        details: text,
      });
      expect(request).not.toHaveBeenCalled();
    }
  );

  it.each([
    [
      'at conference today and tomorrow',
      interval({
        status: 'AWAY',
        toDate: '2026-09-08',
        comment: 'at conference today and tomorrow',
      }),
    ],
    [
      'at conference today and tomorow',
      interval({
        status: 'AWAY',
        toDate: '2026-09-08',
        comment: 'at conference today and tomorow',
      }),
    ],
    [
      'At conference today and tomorow',
      interval({
        status: 'AWAY',
        toDate: '2026-09-08',
        comment: 'At conference today and tomorow',
      }),
    ],
    [
      '  :stadium:  at conference today and tomorow  ',
      interval({
        status: 'AWAY',
        toDate: '2026-09-08',
        comment: '  :stadium:  at conference today and tomorow  ',
      }),
    ],
    [
      'på konference i dag og i morgen',
      interval({
        status: 'AWAY',
        toDate: '2026-09-08',
        comment: 'på konference i dag og i morgen',
      }),
    ],
    [
      'til konference i dag og i morgen',
      interval({
        status: 'AWAY',
        toDate: '2026-09-08',
        comment: 'til konference i dag og i morgen',
      }),
    ],
    [
      'today and tomorrow at conference',
      interval({
        status: 'AWAY',
        toDate: '2026-09-08',
        comment: 'today and tomorrow at conference',
      }),
    ],
    [
      'at conference tomorrow',
      interval({
        status: 'AWAY',
        fromDate: '2026-09-08',
        toDate: '2026-09-08',
        comment: 'at conference tomorrow',
      }),
    ],
    [
      'at conference tomorow',
      interval({
        status: 'AWAY',
        fromDate: '2026-09-08',
        toDate: '2026-09-08',
        comment: 'at conference tomorow',
      }),
    ],
    [
      'til konference i morgen',
      interval({
        status: 'AWAY',
        fromDate: '2026-09-08',
        toDate: '2026-09-08',
        comment: 'til konference i morgen',
      }),
    ],
    ['at conference today', interval({ status: 'AWAY', comment: 'at conference today' })],
  ])('resolves conference pattern "%s" without an AI configuration', async (text, expected) => {
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
    'not in the office',
    'not in the office today',
    'not in Aalborg today',
    'ikke i Aarhus i dag',
    'Vacation in Warsaw this week',
    'Anyone in Odense today?',
    'In Ballerup today?',
    'Daniel is in Aalborg today',
    'In Roskilde today',
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

  it('passes a bare clock to AI and accepts its office-arrival interpretation', async () => {
    const arrival = {
      decision: 'apply',
      reason: 'clear',
      intervals: [
        interval({ status: 'IN_LATE', endTime: '09:30' }),
        interval({ status: 'IN_OFFICE', startTime: '09:30' }),
      ],
    };
    const request = vi.fn().mockResolvedValue(reply(arrival));
    vi.stubEnv('AI_GATEWAY_API_KEY', 'synthetic-test-key');
    vi.stubGlobal('fetch', request);

    await expect(extractAttendance('9:30', sent)).resolves.toEqual(arrival);
    expect(request).toHaveBeenCalledOnce();
  });

  it('gives the AI the same KommuneKredit, KMD office cities, and lunch shorthand rules', async () => {
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
    const systemPrompt = payload.messages[0].content;
    expect(systemPrompt).toContain('KommuneKredit');
    expect(systemPrompt).toContain('11:00');
    for (const expectedTerm of [
      'Ballerup',
      'Odense',
      'Aalborg',
      'Aarhus',
      'Århus',
      'Warszawa',
      'Warsaw',
      'AT_CLIENT',
    ]) {
      expect(systemPrompt).toContain(expectedTerm);
    }
  });
});
