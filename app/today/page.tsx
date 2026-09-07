import { requirePageUserId } from '@/lib/auth/require-user';
import { UserWithExtras } from '@/db/types';
import { PeopleOverviewWrapper } from './PeopleOverviewWrapper';
import { userService } from '@/lib/services/userService';
import { Toaster } from '@/components/ui/sonner';
import React from 'react';

export default async function Home() {
  await requirePageUserId();
  const users: UserWithExtras[] = await userService.getAllUsers();

  return (
    <div>
      <PeopleOverviewWrapper initialProfiles={users} />
      <Toaster />
    </div>
  );
}
