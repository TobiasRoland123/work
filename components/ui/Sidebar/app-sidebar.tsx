import type * as React from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/Sidebar/sidebar';
import { Logo } from '@/components/ui/Logo/Logo';
import Link from 'next/link';
import { linkProps } from '@/types/link';

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  linkList?: Array<linkProps>;
};

export function AppSidebar({ linkList, ...props }: AppSidebarProps) {
  return (
    <>
      <Sidebar {...props}>
        <SidebarHeader className={'pb-5 px-4'}>
          <Link href={'/'}>
            <Logo />
          </Link>
        </SidebarHeader>
        <SidebarContent className={'h-full pb-5 px-4'}>
          <nav className={'mt-auto'} aria-label="App Navigation">
            <ul className={'flex gap-8 flex-col justify-end'}>
              {linkList &&
                linkList?.length > 0 &&
                linkList?.map((item, index) => {
                  if (!item.href) return;
                  return (
                    <li key={`${index}_${item.href}`}>
                      <Link href={item.href}>{item?.label}</Link>
                    </li>
                  );
                })}
            </ul>
          </nav>
        </SidebarContent>
        <SidebarRail />
      </Sidebar>
    </>
  );
}
