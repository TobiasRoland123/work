import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Status } from '@/db/types';
import { copenhagenWallClock } from '@/lib/status/active';
import {
  echoContent,
  echoPostDay,
  isEchoable,
  isEchoCancelled,
  isEchoDue,
  isEchoExpired,
  renderEcho,
  replacedEchoDays,
  type EchoContent,
} from '@/lib/status/echo';

// 2 November 2026 is a Monday in winter time (UTC+1); 15 June 2026 a Monday in summer (UTC+2).
const declaration = (overrides: Partial<Status> = {}): Status => ({
  id: 1,
  userID: 'anna',
  status: 'FROM_HOME',
  details: null,
  emoji: null,
  time: null,
  fromDate: '2026-11-04',
  toDate: '2026-11-04',
  startsAt: null,
  endsAt: null,
  startsAtApproximate: false,
  endsAtApproximate: false,
  sourceMessageKey: null,
  createdAt: '2026-11-02T09:00:00Z',
  announcedAt: new Date('2026-11-02T09:00:00Z'),
  ...overrides,
});
const at = (iso: string) => new Date(iso);

describe('which Declarations are echoed', () => {
  it('echoes exceptions, including arriving late and leaving early', () => {
    for (const status of ['FROM_HOME', 'SICK', 'VACATION', 'IN_LATE', 'LEAVING_EARLY'] as const)
      expect(isEchoable(declaration({ status }))).toBe(true);
  });
  it('never echoes being in the office, a note without a status or a Slack import', () => {
    expect(isEchoable(declaration({ status: 'IN_OFFICE' }))).toBe(false);
    expect(isEchoable(declaration({ status: null }))).toBe(false);
    expect(isEchoable(declaration({ sourceMessageKey: 'T:C:1790000000.000100' }))).toBe(false);
    expect(echoContent(declaration({ status: 'IN_OFFICE' }))).toBeNull();
  });
});

describe('the day an Echo is posted', () => {
  it('is the day the Declaration starts', () => {
    expect(echoPostDay(declaration(), at('2026-11-02T10:00:00Z'))).toBe('2026-11-04');
  });
  it('is the following Monday for a Declaration starting on a weekend', () => {
    const fromSaturday = declaration({ fromDate: '2026-11-07', toDate: '2026-11-11' });
    expect(echoPostDay(fromSaturday, at('2026-11-05T10:00:00Z'))).toBe('2026-11-09');
  });
  it('is today for a period that already started, never a day already gone', () => {
    const thisWeek = declaration({ fromDate: '2026-11-02', toDate: '2026-11-06' });
    expect(echoPostDay(thisWeek, at('2026-11-04T13:00:00Z'))).toBe('2026-11-04');
  });
  it('does not exist for a Declaration covering only a weekend', () => {
    const weekend = declaration({ fromDate: '2026-11-07', toDate: '2026-11-08' });
    expect(echoPostDay(weekend, at('2026-11-05T10:00:00Z'))).toBeNull();
  });
});

describe('when an Echo is due', () => {
  it('waits for 08:00 Copenhagen in winter time', () => {
    expect(isEchoDue('2026-11-02', at('2026-11-02T06:59:00Z'))).toBe(false);
    expect(isEchoDue('2026-11-02', at('2026-11-02T07:00:00Z'))).toBe(true);
  });
  it('waits for 08:00 Copenhagen in summer time', () => {
    expect(isEchoDue('2026-06-15', at('2026-06-15T05:59:00Z'))).toBe(false);
    expect(isEchoDue('2026-06-15', at('2026-06-15T06:00:00Z'))).toBe(true);
  });
  it('is due at once when saved for today after 08:00', () => {
    const saved = at('2026-11-02T13:15:00Z');
    expect(
      isEchoDue(
        echoPostDay(declaration({ fromDate: '2026-11-02', toDate: '2026-11-02' }), saved)!,
        saved
      )
    ).toBe(true);
  });
  it('is never due ahead of its day, even when the sandbox forces the 08:00 run', () => {
    expect(isEchoDue('2026-11-03', at('2026-11-02T22:00:00Z'), true)).toBe(false);
    expect(isEchoDue('2026-11-03', at('2026-11-02T23:30:00Z'), true)).toBe(true);
    expect(isEchoDue('2026-11-03', at('2026-11-02T23:30:00Z'))).toBe(false);
  });
  it('is given up only once its Copenhagen day has ended', () => {
    expect(isEchoExpired('2026-11-02', at('2026-11-02T22:59:00Z'))).toBe(false);
    expect(isEchoExpired('2026-11-02', at('2026-11-02T23:00:00Z'))).toBe(true);
  });
});

describe('the Echo cron schedule', () => {
  const schedules: string[] = JSON.parse(readFileSync('vercel.json', 'utf8'))
    .crons.filter((cron: { path: string }) => cron.path === '/api/echoes')
    .map((cron: { schedule: string }) => cron.schedule);

  it('runs on weekdays only, at most once a day per entry', () => {
    expect(schedules.length).toBeGreaterThan(0);
    for (const schedule of schedules) expect(schedule).toMatch(/^0 \d{1,2} \* \* 1-5$/);
  });
  it('has a run in the 08:00 Copenhagen hour in both winter and summer time', () => {
    const hours = schedules.map((schedule) => Number(schedule.split(' ')[1]));
    for (const day of ['2026-11-02', '2026-06-15']) {
      const eight = copenhagenWallClock(day, 8, 0).getUTCHours();
      expect(hours).toContain(eight);
    }
  });
});

const content = (overrides: Partial<EchoContent> = {}): EchoContent => ({
  status: 'VACATION',
  emoji: '🌴',
  details: null,
  fromDate: '2026-11-02',
  toDate: '2026-11-13',
  timeNote: null,
  ...overrides,
});

describe('Echo text', () => {
  it('names the whole range of a multi-day Declaration in one message', () => {
    expect(renderEcho(content())).toBe('🌴 *Vacation* · Mon 2 Nov – Fri 13 Nov');
  });
  it('shows the arrival time and the default emoji of a late arrival', () => {
    const late = echoContent(
      declaration({
        status: 'IN_LATE',
        fromDate: '2026-11-03',
        toDate: '2026-11-03',
        time: copenhagenWallClock('2026-11-03', 9, 30),
      })
    )!;
    expect(renderEcho(late)).toBe('🕒 *In late* · Tue 3 Nov · from 09:30');
  });
  it('quotes the note word for word, escaping what Slack reads as markup', () => {
    const note = 'Dentist <3 & then\nback "after" lunch > 12';
    expect(
      renderEcho(content({ fromDate: '2026-11-03', toDate: '2026-11-03', details: note }))
    ).toBe('🌴 *Vacation* · Tue 3 Nov\n> Dentist &lt;3 &amp; then\n> back "after" lunch &gt; 12');
  });
  it('crosses out replaced days and keeps the rest', () => {
    expect(renderEcho(content(), ['2026-11-04', '2026-11-05'])).toBe(
      '🌴 *Vacation* · Mon 2 Nov – Tue 3 Nov, ~Wed 4 Nov – Thu 5 Nov~, Fri 6 Nov – Fri 13 Nov'
    );
  });
  it('crosses out the whole Echo and marks it cancelled when every day is replaced', () => {
    const replaced = ['02', '03', '04', '05', '06', '09', '10', '11', '12', '13'].map(
      (day) => `2026-11-${day}`
    );
    expect(renderEcho(content({ details: 'Mallorca' }), replaced)).toBe(
      '~🌴 Vacation · Mon 2 Nov – Fri 13 Nov~ · *Cancelled*\n> ~Mallorca~'
    );
  });
});

describe('days a newer Declaration replaced', () => {
  const echoed = declaration({
    id: 1,
    status: 'VACATION',
    fromDate: '2026-11-02',
    toDate: '2026-11-06',
  });
  const range = { fromDate: '2026-11-02', toDate: '2026-11-06' };

  it('are the days a newer Declaration covers, by the board’s newest-wins rule', () => {
    const newer = declaration({
      id: 2,
      fromDate: '2026-11-04',
      toDate: '2026-11-04',
      announcedAt: new Date('2026-11-03T09:00:00Z'),
    });
    expect(replacedEchoDays(range, 1, [echoed, newer])).toEqual(['2026-11-04']);
  });
  it('ignore older Declarations', () => {
    const older = declaration({ id: 2, announcedAt: new Date('2026-11-01T09:00:00Z') });
    expect(replacedEchoDays(range, 1, [echoed, older])).toEqual([]);
  });
  it('are every day once the Declaration is removed, which cancels the Echo', () => {
    const replaced = replacedEchoDays(range, null, []);
    expect(replaced).toHaveLength(5);
    expect(isEchoCancelled(range, replaced)).toBe(true);
  });
});
