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

  function getProfilesInAndOutOfOffice(profiles: Array<UserWithExtras>) {
    const profilesInOffice: UserWithExtras[] = [];
    const profilesOutOfOffice: UserWithExtras[] = [];

    profiles.map((profile) => {
      if (
        profile.status === null ||
        profile.status?.status === 'IN_OFFICE' ||
        (profile.status?.status === 'IN_LATE' &&
          profile.status.time !== null &&
          profile.status.time < new Date(Date.now())) ||
        (profile.status?.status === 'LEAVING_EARLY' &&
          profile.status.time !== null &&
          profile.status.time > new Date(Date.now()))
      ) {
        profilesInOffice.push(profile);
      } else {
        profilesOutOfOffice.push(profile);
      }
    });
    return [profilesInOffice, profilesOutOfOffice];
  }

  const [profilesInOffice, profilesOutOfOffice] = getProfilesInAndOutOfOffice(profiles);

  return (
    <PeopleOverview
      profiles={officeStatus ? profilesInOffice : profilesOutOfOffice}
      officeStatus={officeStatus}
      setOfficeStatus={setOfficeStatus}
      showStatus
    />
  );
};
