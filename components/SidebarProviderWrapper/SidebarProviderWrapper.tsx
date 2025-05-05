'use client';
import { AppSidebar } from '@/components/ui/Sidebar/app-sidebar';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/Sidebar/sidebar';
import { StatusSidebar } from '@/components/ui/StatusSidebar/StatusSidebar';
import type * as React from 'react';
import { ReactNode, useState } from 'react';
import { linkProps } from '@/types/link';
type SidebarProviderWrapperProps = {
  children: ReactNode;
  links: Array<linkProps>;
};

export function SidebarProviderWrapper({ children, links }: SidebarProviderWrapperProps) {
  const [open, setOpen] = useState('navigation');

  return (
    <SidebarProvider
      open={open === 'navigation'}
      onOpenChange={() => setOpen(open === 'navigation' ? 'status' : 'navigation')}
    >
      <AppSidebar className={'md:block hidden'} linkList={links} />
      <SidebarInset className={'relative'}>
        {children}
        <SidebarTrigger
          open={open}
          setOpen={setOpen}
          className="fixed bottom-5 right-3.5 hidden md:block"
        />
      </SidebarInset>
      <StatusSidebar open={open} setOpen={setOpen} />
    </SidebarProvider>
  );
}
