import { handleSyncRequest } from '@/lib/slack/cron';
import { syncDirectory } from '@/lib/slack/directory';
import { withSlackSyncLock } from '@/lib/slack/sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleSyncRequest(request, () => withSlackSyncLock(() => syncDirectory()));
}
