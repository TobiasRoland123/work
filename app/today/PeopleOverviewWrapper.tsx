'use client';
import PeopleOverview from '@/components/ui/PeopleOverview/PeopleOverview';

import { UserWithExtras } from '@/db/types';
import { useState } from 'react';

export const PeopleOverviewWrapper = (props: {
  initialProfiles: UserWithExtras[];
  initialOfficeStatus?: boolean;
}) => {
  const [officeStatus, setOfficeStatus] = useState(props.initialOfficeStatus || false);
  const [profiles] = useState(props.initialProfiles || []);

  const filteredProfiles = officeStatus
    ? profiles.filter((profile) => profile.status?.status === 'IN_OFFICE')
    : profiles.filter((profile) => profile.status?.status !== 'IN_OFFICE');

  return (
    <PeopleOverview
      profiles={filteredProfiles}
      officeStatus={officeStatus}
      setOfficeStatus={setOfficeStatus}
      showStatus
    />
  );
};
