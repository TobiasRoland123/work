import { NextRequest, NextResponse } from 'next/server';
import { seedSlackUsers } from '@/scripts/seed';
import { cleanupExpiredSlackMessages } from '@/lib/slack/inbox';
import { hasExactCronAuthorization } from '@/lib/auth/cron';

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
