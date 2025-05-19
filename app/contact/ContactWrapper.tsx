'use client';

import PeopleOverview from '@/components/ui/PeopleOverview/PeopleOverview';
import { UserWithExtras } from '@/db/types';
import React from 'react';

interface UserProps {
  users: UserWithExtras[];
}

const ContactWrapper = ({ users }: UserProps) => {
  return (
    <div>
      <div>
        <PeopleOverview profiles={users} showTotalPeople />
      </div>
    </div>
  );
};

export default ContactWrapper;
