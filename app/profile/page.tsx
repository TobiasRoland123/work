import { auth } from '@/auth';
import ProfileInfo from '@/components/ui/ProfileInfo/ProfileInfo';

import { userService } from '@/lib/services/userService';
import React from 'react';
import { Toaster } from 'sonner';

const page = async () => {
  const session = await auth();

  if (!session?.userId) {
    return <div>User not found🤔.</div>;
  }

  const user = await userService.getUserById(session.userId);

  if (!user) {
    return <div>User not found.</div>;
  }

  return (
    <div>
      {user && <ProfileInfo user={user} />} <Toaster />
    </div>
  );
};

export default page;
