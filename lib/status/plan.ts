import { z } from 'zod';
import { userStatus } from '@/db/schema';
import type { NewStatus, Status } from '@/db/types';
import { copenhagenDate, copenhagenWallClock } from './active';

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const timedStatuses: readonly string[] = ['IN_LATE', 'LEAVING_EARLY'];
export const rangeStatuses: readonly string[] = ['VACATION', 'ON_LEAVE'];

export const planSchema = z.object({
  status: z.enum(userStatus.enumValues),
  details: z.string().trim().max(2000).optional(),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  when: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('days'), days: z.array(isoDay).min(1).max(62) }),
    z.object({ kind: z.literal('range'), from: isoDay, to: isoDay }),
  ]),
});
export type PlanInput = z.infer<typeof planSchema>;

/** A plan the person can fix; the message is safe to show as is. */
export class PlanError extends Error {}

export type PlannedStatus = Pick<NewStatus, 'status' | 'details' | 'fromDate' | 'toDate' | 'time'>;

function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function assertRealDay(day: string) {
  const parsed = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day)
    throw new PlanError(`${day} is not a valid date.`);
}

const isWeekend = (day: string) => [0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay());

/** Group sorted days into runs; a gap of only Saturday and Sunday keeps a run going. */
export function dayRuns(days: readonly string[]): [string, string][] {
  return days.reduce<[string, string][]>((runs, day) => {
    const last = runs.at(-1);
    let gap = last ? addDays(last[1], 1) : null;
    while (gap && gap < day && isWeekend(gap)) gap = addDays(gap, 1);
    if (last && gap === day) last[1] = day;
    else runs.push([day, day]);
    return runs;
  }, []);
}

/**
 * Turn a plan into Declarations: one per run of days, or one per day when a clock time
 * needs its own Copenhagen date.
 */
export function planStatuses(input: unknown, now: Date = new Date()): PlannedStatus[] {
  const plan = planSchema.parse(input);
  const today = copenhagenDate(now);
  const latest = addDays(today, 366);
  const timed = timedStatuses.includes(plan.status);
  const officeArrival = plan.status === 'IN_OFFICE' && Boolean(plan.time);
  const details = plan.status === 'SICK' ? null : plan.details || null;

  if (timed && !plan.time) throw new PlanError('Choose a time.');
  if (timed && plan.when.kind === 'range')
    throw new PlanError('Pick the days you are in late or leaving early.');

  if (plan.when.kind === 'range') {
    const { from, to } = plan.when;
    assertRealDay(from);
    assertRealDay(to);
    if (from > to) throw new PlanError('The end date must be on or after the start date.');
    if (to < today) throw new PlanError('The period must end today or later.');
    if (to > latest) throw new PlanError('You can plan up to a year ahead.');
    if (!officeArrival)
      return [{ status: plan.status, details, fromDate: from, toDate: to, time: null }];
  }

  let days: string[];
  if (plan.when.kind === 'range') {
    days = [];
    for (let day = plan.when.from; day <= plan.when.to; day = addDays(day, 1)) {
      if (days.length === 62)
        throw new PlanError('Pick a period of up to 62 days when setting an arrival time.');
      days.push(day);
    }
  } else days = [...new Set(plan.when.days)].sort();
  for (const day of days) {
    assertRealDay(day);
    if (day < today && plan.when.kind === 'days') throw new PlanError('Pick today or a later day.');
    if (day > latest) throw new PlanError('You can plan up to a year ahead.');
  }

  if (timed || officeArrival) {
    const [hours, minutes] = plan.time!.split(':').map(Number);
    return days.map((day) => {
      const time = copenhagenWallClock(day, hours, minutes);
      if (timed && time <= now) throw new PlanError('That time has already passed today.');
      return { status: plan.status, details, fromDate: day, toDate: day, time };
    });
  }

  return dayRuns(days).map(([fromDate, toDate]) => ({
    status: plan.status,
    details,
    fromDate,
    toDate,
    time: null,
  }));
}

function dayOf(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : copenhagenDate(date);
}

export type UpcomingStatus = Status & { firstDay: string; lastDay: string };

/** A person's Declarations that still cover today or a later day, soonest first. */
export function upcomingStatuses(
  statuses: readonly Status[],
  now: Date = new Date()
): UpcomingStatus[] {
  const today = copenhagenDate(now);
  return statuses
    .flatMap((status) => {
      const firstDay =
        status.fromDate ??
        dayOf(status.time ?? status.startsAt ?? status.announcedAt ?? status.createdAt);
      if (!firstDay) return [];
      const lastDay = status.toDate ?? dayOf(status.endsAt) ?? firstDay;
      return lastDay >= today ? [{ ...status, firstDay, lastDay }] : [];
    })
    .sort((a, b) => a.firstDay.localeCompare(b.firstDay) || b.id - a.id);
}
