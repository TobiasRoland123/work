'use client'
import {
  Sidebar, SidebarContent, SidebarGroup,
  SidebarHeader,
  SidebarProvider, SidebarTrigger,
} from '@/components/ui/Sidebar/sidebar';
import { Logo } from '@/components/ui/Logo/Logo';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useState } from 'react';

type DesktopSidebarsProps = {
  className?: string;
}




export function DesktopSidebars({className}: DesktopSidebarsProps) {
  const [open, setOpen] = useState('navigation');

  const handleSidebarsOpen=()=>{
    if(open === 'navigation'){
      setOpen('status');
    }else if(open === 'status'){
      setOpen('navigation');
    }
  }
  return  <> <SidebarProvider  open={open === 'navigation'} onOpenChange={() => handleSidebarsOpen()}>
    <Sidebar className={cn('font-mono', className)}>
      <div className={'p-5 h-full flex justify-between flex-col'}>
        <SidebarHeader>
          <Logo />
        </SidebarHeader>
        <SidebarContent className={'mt-auto'}>
          <SidebarGroup className={'gap-4'}>
            <Link href="/">Test</Link>
            <Link href="/">Test</Link>
            <Link href="/">Test</Link>
            <Link href="/">Test</Link>
            <Link href="/">Test</Link>
          </SidebarGroup>
        </SidebarContent>
      </div>
    </Sidebar>
    <SidebarTrigger className={'absolute bottom-5 right-4'} />
  </SidebarProvider>


  <SidebarProvider  open={open === 'status'} onOpenChange={() => handleSidebarsOpen()}>
    <Sidebar className={cn('font-mono', className)}>
      <div className={'p-5 h-full flex justify-between flex-col'}>
        <SidebarHeader>
          <Logo />
        </SidebarHeader>
        <SidebarContent className={'mt-auto'}>
          <SidebarGroup className={'gap-4'}>
            <Link href="/">Test</Link>
            <Link href="/">Test</Link>
            <Link href="/">Test</Link>
            <Link href="/">Test</Link>
            <Link href="/">Test</Link>
          </SidebarGroup>
        </SidebarContent>
      </div>
    </Sidebar>
    <SidebarTrigger className={'absolute bottom-5 right-4'} />
  </SidebarProvider></>
}