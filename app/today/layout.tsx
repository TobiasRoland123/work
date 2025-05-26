import { ReactNode } from 'react';
import { SidebarProviderWrapper } from '@/components/SidebarProviderWrapper/SidebarProviderWrapper';
import { MobileNavigation } from '@/components/ui/MobileNavigation/Mobilenavigation';
import { menuLinks } from '@/components/AppContent';
import { auth } from '@/auth';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  return (
    <main>
      <SidebarProviderWrapper links={menuLinks} showStatusSidebar userId={session?.userId}>
        {children}
      </SidebarProviderWrapper>

      <MobileNavigation linkList={menuLinks} userId={session?.userId} />
    </main>
  );
}
