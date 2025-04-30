'use client';
import PeopleOverview from '@/components/ui/PeopleOverview/PeopleOverview';
import { ProfileListItemProps } from '@/components/ui/ProfileListItem/ProfileListItem';
import { useState } from 'react';

export const PeopleOverviewWrapper = (props: {
  initialProfiles: ProfileListItemProps[];
  initialOfficeStatus?: boolean;
}) => {
  const [officeStatus, setOfficeStatus] = useState(props.initialOfficeStatus || false);
  const [profiles] = useState(props.initialProfiles || []);

  const filteredProfiles = officeStatus
    ? profiles.filter((profile) => profile.status === 'in office')
    : profiles.filter((profile) => profile.status !== 'in office');

  return (
    <PeopleOverview
      profiles={filteredProfiles}
      officeStatus={officeStatus}
      setOfficeStatus={setOfficeStatus}
    />
  );
};
