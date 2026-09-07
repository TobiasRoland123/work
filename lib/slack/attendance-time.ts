const TIME_ZONE = 'Europe/Copenhagen';

const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const timePattern = /^(\d{2}):(\d{2})$/;

function validDateParts(value: string): boolean {
  const match = datePattern.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year && candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day;
}

function localParts(date: Date): { date: string; time: string } {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map(({ type, value }) => [type, value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/** Returns the local calendar date in Copenhagen. */
export function copenhagenDate(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new Error('Invalid date');
  return localParts(date).date;
}

/** Converts a Copenhagen wall-clock value only when it maps to one UTC instant. */
export function localDateTimeToUtc(date: string, time: string): Date | null {
  if (!validDateParts(date)) return null;
  const match = timePattern.exec(time);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;

  const [year, month, day] = date.split('-').map(Number);
  const target = `${date}T${time}`;
  const base = Date.UTC(year, month - 1, day, hour, minute);
  const matches: number[] = [];
  for (let offset = -18 * 60; offset <= 18 * 60; offset += 15) {
    const candidate = new Date(base - offset * 60_000);
    const parts = localParts(candidate);
    if (`${parts.date}T${parts.time}` === target) matches.push(candidate.getTime());
  }
  const unique = [...new Set(matches)];
  return unique.length === 1 ? new Date(unique[0]) : null;
}

export function isIsoLocalDate(value: string): boolean {
  return validDateParts(value);
}
