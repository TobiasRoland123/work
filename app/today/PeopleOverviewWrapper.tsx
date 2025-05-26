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
    ? profiles.filter(
        (profile) =>
          profile.status === null ||
          profile.status?.status === 'IN_OFFICE' ||
          (profile.status?.status === 'IN_LATE' &&
            profile.status.time !== null &&
            profile.status.time < new Date(Date.now())) ||
          (profile.status?.status === 'LEAVING_EARLY' &&
            profile.status.time !== null &&
            profile.status.time > new Date(Date.now()))
      )
    : profiles.filter(
        (profile) =>
          (profile.status !== null && profile.status?.status !== 'IN_OFFICE') ||
          (profile.status?.status === 'IN_LATE' &&
            profile.status.time !== null &&
            profile.status.time > new Date(Date.now())) ||
          (profile.status?.status === 'LEAVING_EARLY' &&
            profile.status.time !== null &&
            profile.status.time < new Date(Date.now()))
      );

  return (
    <PeopleOverview
      profiles={filteredProfiles}
      officeStatus={officeStatus}
      setOfficeStatus={setOfficeStatus}
      showStatus
    />
  );
};
