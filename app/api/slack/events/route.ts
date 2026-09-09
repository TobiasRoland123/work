import { NextResponse } from 'next/server';
import { verifySlackSignature } from '@/lib/slack/signature';
import { enqueueSlackEvent } from '@/lib/slack/inbox';
import { publishSlackMessage } from '@/lib/slack/queue';

export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  if (
    !process.env.SLACK_SIGNING_SECRET ||
    !process.env.SLACK_TEAM_ID ||
    !process.env.SLACK_CHANNEL_ID
  ) {
    return NextResponse.json({ error: 'Slack is not configured' }, { status: 503 });
  }
  // Bound the body while streaming so missing Content-Length cannot bypass the limit.
  const reader = request.body?.getReader();
  if (!reader) return new NextResponse(null, { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 256000) {
      await reader.cancel();
      return new NextResponse(null, { status: 413 });
    }
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (
    !verifySlackSignature(
      raw,
      request.headers.get('x-slack-request-timestamp'),
      request.headers.get('x-slack-signature'),
      process.env.SLACK_SIGNING_SECRET
    )
  ) {
    return new NextResponse(null, { status: 401 });
  }
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (payload?.type === 'url_verification' && typeof payload.challenge === 'string') {
    return NextResponse.json({ challenge: payload.challenge });
  }
  try {
    const intake = await enqueueSlackEvent(payload);
    // Only fixed outcomes and normalized identifiers are logged, never message text or secrets.
    console.info('slack_intake', intake);
    if (
      intake.outcome === 'queued' ||
      intake.outcome === 'duplicate_or_stale' ||
      intake.outcome === 'deleted'
    ) {
      // Do not acknowledge Slack until BOTH the inbox commit and durable publication succeed.
      // A retried Slack delivery republishes the same revision with the same idempotency key.
      await publishSlackMessage({ messageKey: intake.messageKey, revision: intake.revision });
    }
    return NextResponse.json({ ok: true });
  } catch {
    console.error('slack_intake', { outcome: 'queue_failed' });
    // Slack retries failed deliveries, including a failed publish after a successful inbox commit.
    return NextResponse.json({ error: 'Unable to queue event' }, { status: 503 });
  }
}
