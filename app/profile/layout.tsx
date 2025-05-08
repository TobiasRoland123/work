import { ReactNode } from 'react';
import { SidebarProviderWrapper } from '@/components/SidebarProviderWrapper/SidebarProviderWrapper';
import { MobileNavigation } from '@/components/ui/MobileNavigation/Mobilenavigation';
import { menuLinks } from '@/components/AppContent';
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <main>
      {/*This layout does not include the StatusSidebar*/}
      <SidebarProviderWrapper links={menuLinks}>{children}</SidebarProviderWrapper>

      <MobileNavigation linkList={menuLinks} />
    </main>
  );
}
