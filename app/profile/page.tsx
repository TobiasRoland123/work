import { auth } from '@/auth';
import ProfileInfo from '@/components/ui/ProfileInfo/ProfileInfo';

import { userService } from '@/lib/services/userService';

import React from 'react';

const page = async () => {
  const session = await auth();

  if (!session?.userId) {
    return <div>User not found.</div>;
  }

  // const user = await userService.getUserById(session.userId);
  const user = await userService.getUserById('b0bb8dda-976d-4992-8922-4fef721c4b09');

  if (!user) {
    return <div>User not found.</div>;
  }

  return <div>{user && <ProfileInfo user={user} />}</div>;
};

export default page;
