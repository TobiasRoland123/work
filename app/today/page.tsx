import { requirePageUserId } from '@/lib/auth/require-user';
import { UserWithExtras } from '@/db/types';
import { PeopleOverviewWrapper } from './PeopleOverviewWrapper';
import { userService } from '@/lib/services/userService';
import React from 'react';

export default async function Home() {
  const userId = await requirePageUserId();
  const users: UserWithExtras[] = await userService.getAllUsers();

  return (
    <div>
      <PeopleOverviewWrapper
        initialProfiles={users}
        userId={userId}
        dateLabel={new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Europe/Copenhagen',
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        }).format(new Date())}
      />
    </div>
  );
}
