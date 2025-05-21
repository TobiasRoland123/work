'use client';

import * as React from 'react';
import { Button } from '@/components/ui/Button/Button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/Drawer/drawer';
import { useState } from 'react';
import { StatusForm } from '@/components/StatusForm/StatusForm';

type StatusDrawerProps = {
  userId?: string;
};

export function StatusDrawer({ userId }: StatusDrawerProps) {
  const [open, setOpen] = useState(false);
  return (
    <Drawer open={open} onClose={() => setOpen(false)}>
      <DrawerTrigger asChild>
        <Button
          variant={'default'}
          ariaLabel="Report status"
          handleClick={() => {
            setOpen(true);
          }}
          className="fixed bottom-22 right-4 md:hidden"
        >
          Report status
        </Button>
      </DrawerTrigger>
      <DrawerContent className={'bg-black text-white font-mono pt-7 pb-5 px-3.5'}>
        <DrawerHeader className={'flex justify-between flex-row'}>
          <DrawerTitle className={'text-white block'}> Where are you today?</DrawerTitle>
          <DrawerClose className={'text-white block'}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none">
              <path fill="#0B1014" d="M0 0h20v20H0z" />
              <path
                fill="#0B1014"
                d="M0 0h2.5v2.5H0zM17.5 0H20v2.5h-2.5zM2.5 2.5H5V5H2.5zM15 2.5h2.5V5H15zM5 5h2.5v2.5H5zM12.5 5H15v2.5h-2.5zM7.5 7.5H10V10H7.5zM10 7.5h2.5V10H10zM7.5 10H10v2.5H7.5zM10 10h2.5v2.5H10zM5 12.5h2.5V15H5zM12.5 12.5H15V15h-2.5zM2.5 15H5v2.5H2.5zM15 15h2.5v2.5H15zM0 17.5h2.5V20H0z"
              />
              <path
                fill="#A5CDF0"
                fillRule="evenodd"
                d="M10 12.5H8.1a.6.6 0 0 0-.6.6v1.3a.6.6 0 0 1-.6.6H5.6a.6.6 0 0 0-.6.6v1.3a.6.6 0 0 1-.6.6H3.1a.6.6 0 0 0-.6.6v1.3a.6.6 0 0 0 .6.6h13.8a.6.6 0 0 0 .6-.6v-1.3a.6.6 0 0 0-.6-.6h-1.3a.6.6 0 0 1-.6-.6v-1.3a.6.6 0 0 0-.6-.6h-1.3a.6.6 0 0 1-.6-.6v-1.3a.6.6 0 0 0-.6-.6H10ZM7.5 10V8.1a.6.6 0 0 0-.6-.6H5.6a.6.6 0 0 1-.6-.6V5.6a.6.6 0 0 0-.6-.6H3.1a.6.6 0 0 1-.6-.6V3.1a.6.6 0 0 0-.6-.6H.6a.6.6 0 0 0-.6.6v13.8a.6.6 0 0 0 .6.6h1.3a.6.6 0 0 0 .6-.6v-1.3a.6.6 0 0 1 .6-.6h1.3a.6.6 0 0 0 .6-.6v-1.3a.6.6 0 0 1 .6-.6h1.3a.6.6 0 0 0 .6-.6V10ZM12.5 10v1.9a.6.6 0 0 0 .6.6h1.3a.6.6 0 0 1 .6.6v1.3a.6.6 0 0 0 .6.6h1.3a.6.6 0 0 1 .6.6v1.3a.6.6 0 0 0 .6.6h1.3a.6.6 0 0 0 .6-.6V3.1a.6.6 0 0 0-.6-.6h-1.3a.6.6 0 0 0-.6.6v1.3a.6.6 0 0 1-.6.6h-1.3a.6.6 0 0 0-.6.6v1.3a.6.6 0 0 1-.6.6h-1.3a.6.6 0 0 0-.6.6V10ZM10 7.5h1.9a.6.6 0 0 0 .6-.6V5.6a.6.6 0 0 1 .6-.6h1.3a.6.6 0 0 0 .6-.6V3.1a.6.6 0 0 1 .6-.6h1.3a.6.6 0 0 0 .6-.6V.6a.6.6 0 0 0-.6-.6H3.1a.6.6 0 0 0-.6.6v1.3a.6.6 0 0 0 .6.6h1.3a.6.6 0 0 1 .6.6v1.3a.6.6 0 0 0 .6.6h1.3a.6.6 0 0 1 .6.6v1.3a.6.6 0 0 0 .6.6H10Z"
                clipRule="evenodd"
              />
              <path fill="#0B1014" d="M17.5 17.5H20V20h-2.5z" />
            </svg>
          </DrawerClose>
        </DrawerHeader>
        <div className={'gap-4 flex flex-col'}>
          <StatusForm userId={userId} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
