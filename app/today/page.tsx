import { UserWithExtras } from '@/db/types';
import { PeopleOverviewWrapper } from './PeopleOverviewWrapper';
import { userService } from '@/lib/services/userService';
import { Toaster } from '@/components/ui/sonner';
import React from 'react';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function Home() {
  await delay(2000);
  const users: UserWithExtras[] = await userService.getAllUsers();

  return (
    <div>
      <PeopleOverviewWrapper initialProfiles={users} initialOfficeStatus />
      <Toaster />
    </div>
  );
}
