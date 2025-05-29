import { UserWithExtras } from '@/db/types';
import { PeopleOverviewWrapper } from './PeopleOverviewWrapper';
import { userService } from '@/lib/services/userService';
import { Toaster } from '@/components/ui/sonner';
import React from 'react';

export default async function Home() {
  const users: UserWithExtras[] = await userService.getAllUsers();

  return (
    <div>
      <PeopleOverviewWrapper initialProfiles={users} initialOfficeStatus />
      <Toaster />
    </div>
  );
}
