import { ReactNode, Suspense } from 'react';
import { SidebarProviderWrapper } from '@/components/SidebarProviderWrapper/SidebarProviderWrapper';
import { MobileNavigation } from '@/components/ui/MobileNavigation/Mobilenavigation';
import { menuLinks } from '@/components/AppContent';
import Loading from './loading';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <main>
      <SidebarProviderWrapper links={menuLinks}>
        <Suspense fallback={<Loading />}>{children}</Suspense>
      </SidebarProviderWrapper>

      <MobileNavigation linkList={menuLinks} />
    </main>
  );
}
