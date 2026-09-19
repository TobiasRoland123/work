import type { ReactNode } from 'react';
import { requirePageUserId } from '@/lib/auth/require-user';
import { userService } from '@/lib/services/userService';
import { AppShell } from './AppShell';
import { Toaster } from '@/components/ui/sonner';

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const userId = await requirePageUserId();
  const user = await userService.getUserById(userId);
  return (
    <AppShell firstName={user?.firstName}>
      {children}
      <Toaster />
    </AppShell>
  );
}
