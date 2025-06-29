import { ReactNode, Suspense } from 'react';
import { SidebarProviderWrapper } from '@/components/SidebarProviderWrapper/SidebarProviderWrapper';
import { MobileNavigation } from '@/components/ui/MobileNavigation/Mobilenavigation';
import { menuLinks } from '@/components/AppContent';
import { auth } from '@/auth';
import Loading from './loading';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  return (
    <main id="dashboard-main" className="w-screen h-svh overflow-y-auto pl-[calc(100vw - 100%)]">
      <SidebarProviderWrapper links={menuLinks} showStatusSidebar userId={session?.userId}>
        <Suspense fallback={<Loading />}>{children}</Suspense>
      </SidebarProviderWrapper>

      <MobileNavigation linkList={menuLinks} userId={session?.userId} onToday />
    </main>
  );
}
