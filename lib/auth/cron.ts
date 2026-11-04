/** Scheduled jobs must present exactly `Authorization: Bearer <CRON_SECRET>`. */
export function hasExactCronAuthorization(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`;
}
