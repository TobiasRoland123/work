'use client';

import PeopleOverview from '@/components/ui/PeopleOverview/PeopleOverview';
import { UserWithExtras } from '@/db/types';
import React from 'react';

interface UserProps {
  users: UserWithExtras[];
}

const ContactWrapper = ({ users }: UserProps) => {
  return <PeopleOverview profiles={users} showTotalPeople />;
};

export default ContactWrapper;
