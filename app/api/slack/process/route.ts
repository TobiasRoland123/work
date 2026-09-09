import { NextResponse } from 'next/server';
import { processSlackInbox } from '@/lib/slack/inbox';

export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(request: Request) {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json(await processSlackInbox());
  } catch {
    return NextResponse.json({ error: 'Slack queue processing failed' }, { status: 503 });
  }
}
