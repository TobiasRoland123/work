import { NextRequest, NextResponse } from 'next/server';
import { seedSlackUsers } from '@/scripts/seed';
import { cleanupExpiredSlackMessages } from '@/lib/slack/inbox';

function hasExactCronAuthorization(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!hasExactCronAuthorization(request))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await cleanupExpiredSlackMessages();
    return NextResponse.json(await seedSlackUsers());
  } catch (error) {
    console.error('Slack directory sync failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Slack sync failed' },
      { status: 502 }
    );
  }
}
