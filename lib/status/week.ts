import type { DayPresence, Status } from '@/db/types';
import {
  copenhagenDate,
  copenhagenWallClock,
  resolvePresenceStatus,
  selectDayAnnouncement,
} from './active';

const isoDay = /^\d{4}-\d{2}-\d{2}$/;

export function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function isValidDay(value: unknown): value is string {
  if (typeof value !== 'string' || !isoDay.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Monday of the work week shown for `day`. Saturdays and Sundays look ahead to the next week. */
export function workWeekStart(day: string): string {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  const offset = weekday === 0 ? 1 : weekday === 6 ? 2 : 1 - weekday;
  return addDays(day, offset);
}

/** Monday to Friday, starting from the given Monday. */
export function workWeekDays(monday: string): string[] {
  return Array.from({ length: 5 }, (_, index) => addDays(monday, index));
}

export function shiftWorkWeek(monday: string, weeks: number): string {
  return addDays(monday, weeks * 7);
}

/** Format a YYYY-MM-DD date the same way on the server and in every browser. */
export function formatDay(day: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...options }).format(
    new Date(`${day}T12:00:00Z`)
  );
}

/** The requested week's Monday, or the current work week when the value is missing or invalid. */
export function parseWorkWeekStart(value: unknown, now: Date = new Date()): string {
  return workWeekStart(isValidDay(value) ? value : copenhagenDate(now));
}

/** The requested calendar day, or Copenhagen today when the value is missing or invalid. */
export function parseDay(value: unknown, now: Date = new Date()): string {
  return isValidDay(value) ? value : copenhagenDate(now);
}

/**
 * The view a /today URL asks for: a work week (`week`, its Monday) or one calendar day.
 * A day left undefined follows Copenhagen today.
 */
export function resolveWeekView(
  params: { week?: unknown; day?: unknown },
  now: Date = new Date()
): { week?: string; day?: string } {
  if (params.week) return { week: parseWorkWeekStart(params.week, now) };
  return params.day ? { day: parseDay(params.day, now) } : {};
}

/** ISO 8601 week number of a YYYY-MM-DD date. */
export function isoWeekNumber(day: string): number {
  const date = new Date(`${day}T00:00:00Z`);
  const thursday = new Date(date);
  thursday.setUTCDate(date.getUTCDate() + 3 - ((date.getUTCDay() + 6) % 7));
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  return 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
}

/**
 * Resolve each day with the same rules as today's presence. Other days are read at the start
 * of the workday (09:00 Copenhagen); today is read live, so
 * timed arrivals and departures move as the day goes on.
 */
export function resolveWorkWeek(
  statuses: readonly Status[],
  userID: string,
  days: readonly string[],
  now: Date = new Date()
): DayPresence[] {
  const today = copenhagenDate(now);
  return days.map((date) => {
    const workdayStart = copenhagenWallClock(date, 9, 0);
    const moment = date === today ? now : workdayStart;
    return {
      date,
      status: resolvePresenceStatus(statuses, userID, moment),
      announcement: selectDayAnnouncement(statuses, workdayStart),
    };
  });
}
