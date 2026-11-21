import { slackEchoWritesEnabled, IMPORT_STATUS_UNAVAILABLE } from '@/lib/slack/import-mode';
import { StatusWriteAvailabilityProvider } from './StatusWriteAvailability';
import type { ReactNode } from 'react';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { requirePageUserId } from '@/lib/auth/require-user';
import { canReviewMessages } from '@/lib/auth/message-review';
import { canViewEmployeeStats } from '@/lib/auth/employee-stats';
import { isAdmin } from '@/lib/auth/roles';
import { AppShell } from './AppShell';
import { Toaster } from '@/components/ui/sonner';

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const userId = await requirePageUserId();
  const [[user], showMessageQuality, showEmployeeStats] = await Promise.all([
    db
      .select({ firstName: users.firstName, phoneInviteDismissedAt: users.phoneInviteDismissedAt })
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1),
    canReviewMessages(userId),
    canViewEmployeeStats(userId),
  ]);
  const showRoleManagement = await isAdmin(userId);
  return (
    <StatusWriteAvailabilityProvider enabled={slackEchoWritesEnabled()}>
      <AppShell
        showPhoneInvite={!!user && user.phoneInviteDismissedAt === null}
        firstName={user?.firstName}
        showMessageQuality={showMessageQuality}
        showEmployeeStats={showEmployeeStats}
        showRoleManagement={showRoleManagement}
      >
        {!slackEchoWritesEnabled() && <p role="status">{IMPORT_STATUS_UNAVAILABLE}</p>}
        {children}
        <Toaster />
      </AppShell>
    </StatusWriteAvailabilityProvider>
  );
}
