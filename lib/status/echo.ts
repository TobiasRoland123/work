import type { Status, UserStatus } from '@/db/types';
import { statusLabel, timeNote } from '@/components/week/presence';
import { copenhagenDate, copenhagenWallClock, selectDayAnnouncement } from './active';
import { statusEmoji } from './emoji';
import { declarationDays } from './plan';
import { addDays, formatDay } from './week';

/** Echoes are posted at this Copenhagen hour on their day, before the 09:00 Workday Default. */
export const ECHO_HOUR = 8;
/** How the status form and the person's announcements name the attendance channel. */
export const ECHO_CHANNEL_LABEL = '#wørk';

/** What an Echo announces, copied from its Declaration when the Echo is scheduled. */
export type EchoContent = {
  status: UserStatus;
  emoji: string | null;
  details: string | null;
  fromDate: string;
  toDate: string;
  /** Arrival or leaving time as the board words it, e.g. "from 09:30". */
  timeNote: string | null;
};

type DeclarationTiming = Pick<
  Status,
  'fromDate' | 'toDate' | 'time' | 'startsAt' | 'endsAt' | 'createdAt'
> & { announcedAt?: Date | string | null };

const isWeekend = (day: string) => [0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay());

/**
 * Whether a Declaration can be echoed at all. Being in the office is assumed and never echoed,
 * and Slack-imported Declarations are already in the channel. Who made it is up to the caller.
 */
export function isEchoable(declaration: Pick<Status, 'status' | 'sourceMessageKey'>): boolean {
  return (
    declaration.status !== null &&
    declaration.status !== 'IN_OFFICE' &&
    !declaration.sourceMessageKey
  );
}

/**
 * The weekday an Echo is posted on: the first weekday the Declaration covers from the day it is
 * saved. A Declaration starting on a weekend posts on the following Monday; one covering no
 * weekday from then on has nothing to announce and gets no Echo.
 */
export function echoPostDay(declaration: DeclarationTiming, savedAt: Date): string | null {
  const span = declarationDays(declaration);
  if (!span) return null;
  const today = copenhagenDate(savedAt);
  let day = span.firstDay < today ? today : span.firstDay;
  while (day <= span.lastDay && isWeekend(day)) day = addDays(day, 1);
  return day <= span.lastDay ? day : null;
}

/** The Echo content of a Declaration, or null when it cannot be echoed. */
export function echoContent(
  declaration: DeclarationTiming & Pick<Status, 'status' | 'details' | 'emoji' | 'sourceMessageKey'>
): EchoContent | null {
  if (!isEchoable(declaration) || !declaration.status) return null;
  const span = declarationDays(declaration);
  if (!span) return null;
  return {
    status: declaration.status,
    emoji: declaration.emoji ?? statusEmoji(declaration.status, declaration.details),
    details: declaration.details?.trim() ? declaration.details : null,
    fromDate: span.firstDay,
    toDate: span.lastDay,
    timeNote: timeNote(declaration as Status),
  };
}

/** The instant an Echo for `day` becomes due: 08:00 Copenhagen, in summer and winter time. */
export function echoDueAt(day: string): Date {
  return copenhagenWallClock(day, ECHO_HOUR, 0);
}

/**
 * Whether an Echo should be posted now: only on its own day, from 08:00. `force` lets the
 * Local Sandbox post the day's Echoes before 08:00. Nothing is ever posted ahead of its day.
 */
export function isEchoDue(postOn: string, now: Date, force = false): boolean {
  return postOn === copenhagenDate(now) && (force || now >= echoDueAt(postOn));
}

/** An Echo still unposted after its Copenhagen day has ended is given up. */
export function isEchoExpired(postOn: string, now: Date): boolean {
  return copenhagenDate(now) > postOn;
}

/** The days an Echo names that count: its weekdays, or every day if it names only a weekend. */
function echoDays(content: Pick<EchoContent, 'fromDate' | 'toDate'>): string[] {
  const days: string[] = [];
  for (let day = content.fromDate; day <= content.toDate; day = addDays(day, 1)) days.push(day);
  const weekdays = days.filter((day) => !isWeekend(day));
  return weekdays.length ? weekdays : days;
}

/**
 * The days of an Echo that newer Declarations replaced, by the board's rule that a day belongs
 * to the newest Declaration covering it. Without its Declaration, every day is gone.
 */
export function replacedEchoDays(
  content: Pick<EchoContent, 'fromDate' | 'toDate'>,
  statusId: number | null,
  statuses: readonly Status[]
): string[] {
  const days = echoDays(content);
  if (statusId === null || !statuses.some((row) => row.id === statusId)) return days;
  return days.filter(
    (day) => selectDayAnnouncement(statuses, copenhagenWallClock(day, 9, 0))?.id !== statusId
  );
}

/** Nothing of the Echo still stands: its Declaration was removed or every day replaced. */
export function isEchoCancelled(
  content: Pick<EchoContent, 'fromDate' | 'toDate'>,
  replaced: readonly string[]
): boolean {
  const replacedSet = new Set(replaced);
  return echoDays(content).every((day) => replacedSet.has(day));
}

/** Slack reads &, < and > as markup, so text people wrote must escape them. */
export function escapeSlackText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const shortDay = (day: string) =>
  formatDay(day, { weekday: 'short', day: 'numeric', month: 'short' });
const dayRange = (first: string, last: string) =>
  first === last ? shortDay(first) : `${shortDay(first)} – ${shortDay(last)}`;
const strike = (text: string) => (text.trim() ? `~${text}~` : text);

const echoStatusLabels: Partial<Record<UserStatus, string>> = {
  FROM_HOME: 'From Home',
  REMOTE: 'Working remotely',
};

/** The dates an Echo names, with replaced days crossed out and the others kept. */
function echoDates(content: EchoContent, replaced: ReadonlySet<string>): string {
  if (!replaced.size) return dayRange(content.fromDate, content.toDate);
  const runs: { first: string; last: string; struck: boolean }[] = [];
  for (const day of echoDays(content)) {
    const struck = replaced.has(day);
    const last = runs.at(-1);
    if (last && last.struck === struck) last.last = day;
    else runs.push({ first: day, last: day, struck });
  }
  // The outer runs reach the declared bounds, so the whole range stays named.
  runs[0].first = content.fromDate;
  runs[runs.length - 1].last = content.toDate;
  return runs
    .map(({ first, last, struck }) =>
      struck ? strike(dayRange(first, last)) : dayRange(first, last)
    )
    .join(', ');
}

/**
 * The Slack text of an Echo: status, multi-day dates, any arrival or leaving time, and the
 * person's note word for word as a quote. Replaced days are crossed out; a cancelled Echo
 * is crossed out whole.
 */
export function renderEcho(content: EchoContent, replaced: readonly string[] = []): string {
  const cancelled = isEchoCancelled(content, replaced);
  const label = echoStatusLabels[content.status] ?? statusLabel(content.status);
  const emoji = content.emoji ? `${content.emoji} ` : '';
  const dates =
    content.fromDate === content.toDate
      ? ''
      : ` · ${cancelled ? dayRange(content.fromDate, content.toDate) : echoDates(content, new Set(replaced))}`;
  const time = content.timeNote ? ` · ${content.timeNote}` : '';
  const note = content.details
    ? escapeSlackText(content.details)
        .split('\n')
        .map((line) => `>${line ? ' ' : ''}${cancelled ? strike(line) : line}`)
    : [];
  const headline = cancelled
    ? `~${emoji}${label}${dates}${time}~ · *Cancelled*`
    : `${emoji}*${label}*${dates}${time}`;
  return [headline, ...note].join('\n');
}
