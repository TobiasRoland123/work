import { timingSafeEqual } from 'node:crypto';
import { SlackError } from './client';

export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return false;
  const actual = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function handleSyncRequest(request: Request, run: () => Promise<unknown>) {
  if (!isCronAuthorized(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const result = await run();
    const failed = typeof result === 'object' && result !== null && 'failed' in result && Number(result.failed) > 0;
    return Response.json(result, { status: failed ? 503 : 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: 'Slack sync unavailable. Check server configuration and retry.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store', ...(error instanceof SlackError && error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : {}) },
    });
  }
}
