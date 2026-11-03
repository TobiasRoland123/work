import { NextResponse } from 'next/server';
import { hasExactCronAuthorization } from '@/lib/auth/cron';
import { runEchoJob } from '@/lib/services/echoService';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Weekday cron (vercel.json). Vercel crons run in UTC, so the job runs at both 06:00 and 07:00 UTC
// and posts only from 08:00 Copenhagen; later runs retry failed posts until the day ends.
export async function GET(request: Request) {
  if (!hasExactCronAuthorization(request))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const counts = await runEchoJob();
    console.info('echo_job', counts);
    return NextResponse.json(counts);
  } catch {
    console.error('echo_job', { outcome: 'failed' });
    return NextResponse.json({ error: 'Echo job failed' }, { status: 500 });
  }
}
