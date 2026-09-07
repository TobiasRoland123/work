import { handleSyncRequest } from '@/lib/slack/cron';
import { syncSlackAttendance } from '@/lib/slack/sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  return handleSyncRequest(request, syncSlackAttendance);
}
