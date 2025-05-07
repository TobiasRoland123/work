import { ReactNode } from 'react';
import { SidebarProviderWrapper } from '@/components/SidebarProviderWrapper/SidebarProviderWrapper';
import { MobileNavigation } from '@/components/ui/MobileNavigation/Mobilenavigation';
import { linkProps } from '@/types/link';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const links: Array<linkProps> = [
    { href: '#', label: 'Today' },
    { href: '#', label: 'Contact' },
    { href: '#', label: 'Profile' },
  ];
  return (
    <main>
      <SidebarProviderWrapper links={links} showStatusSidebar>
        {children}
      </SidebarProviderWrapper>

      <MobileNavigation linkList={links} />
    </main>
  );
}
