import { NextResponse } from 'next/server';
import { isDigestTime } from '@/lib/notifications/schedule';
import { notificationService } from '@/lib/services/notificationService';

export const runtime = 'nodejs';

/** Cron endpoint, hit at 07:00 and 08:00 UTC on weekdays; only the 09:00 Copenhagen run sends. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isDigestTime()) return NextResponse.json({ skipped: true });
  try {
    return NextResponse.json({ sent: await notificationService.sendPinnedDigest() });
  } catch (error) {
    console.error('pinned_digest_failed', error);
    return NextResponse.json({ error: 'Pinned colleagues digest failed' }, { status: 502 });
  }
}
