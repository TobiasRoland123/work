const copenhagenClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Copenhagen',
  weekday: 'short',
  hour: '2-digit',
  hourCycle: 'h23',
});

/** The hour of the morning summary, Copenhagen time. */
export const DIGEST_HOUR = 9;

/**
 * Whether `now` falls in the summary hour on a weekday. The cron fires at both 07:00 and 08:00
 * UTC so one of them lands on 09:00 in summer and in winter; the other is skipped here.
 */
export function isDigestTime(now: Date = new Date()): boolean {
  const parts = copenhagenClock.formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return (
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(get('weekday') ?? '') &&
    Number(get('hour')) === DIGEST_HOUR
  );
}
