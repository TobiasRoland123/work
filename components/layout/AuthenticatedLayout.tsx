import type { ReactNode } from 'react';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { requirePageUserId } from '@/lib/auth/require-user';
import { AppShell } from './AppShell';
import { Toaster } from '@/components/ui/sonner';

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const userId = await requirePageUserId();
  const [user] = await db
    .select({ firstName: users.firstName })
    .from(users)
    .where(eq(users.userId, userId))
    .limit(1);
  return (
    <AppShell firstName={user?.firstName}>
      {children}
      <Toaster />
    </AppShell>
  );
}
