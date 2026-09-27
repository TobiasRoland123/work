import type { ReactNode } from 'react';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { requirePageUserId } from '@/lib/auth/require-user';
import { canReviewMessages } from '@/lib/auth/message-review';
import { AppShell } from './AppShell';
import { Toaster } from '@/components/ui/sonner';

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const userId = await requirePageUserId();
  const [[user], showMessageQuality] = await Promise.all([
    db.select({ firstName: users.firstName }).from(users).where(eq(users.userId, userId)).limit(1),
    canReviewMessages(userId),
  ]);
  return (
    <AppShell firstName={user?.firstName} showMessageQuality={showMessageQuality}>
      {children}
      <Toaster />
    </AppShell>
  );
}
