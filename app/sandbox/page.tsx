import { notFound } from 'next/navigation';
import { getSandboxOverview } from '@/app/actions/sandboxActions';
import { AppShell } from '@/components/layout/AppShell';
import { canReviewMessages } from '@/lib/auth/message-review';
import { isSandbox } from '@/lib/sandbox/enabled';
import { SAMPLE_MESSAGES, UNMAPPED_AUTHOR } from '@/lib/sandbox/profiles';
import { SandboxConsole } from './SandboxConsole';

export const dynamic = 'force-dynamic';

export default async function SandboxPage() {
  if (!isSandbox()) notFound();
  const overview = await getSandboxOverview();
  const showMessageQuality = overview.signedIn
    ? await canReviewMessages(overview.signedIn.userId)
    : false;
  return (
    <AppShell firstName={overview.signedIn?.firstName} showMessageQuality={showMessageQuality}>
      <main id="dashboard-main" className="sandbox-page">
        <SandboxConsole
          overview={overview}
          samples={SAMPLE_MESSAGES}
          unmappedAuthor={UNMAPPED_AUTHOR}
        />
      </main>
    </AppShell>
  );
}
