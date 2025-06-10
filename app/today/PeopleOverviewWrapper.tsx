'use client';
import PeopleOverview from '@/components/ui/PeopleOverview/PeopleOverview';
import { useCallback, useEffect, useState } from 'react';
import { UserWithExtras } from '@/db/types';
import { getAllUsersAction } from '../actions/userActions';
import { supabase } from '@/lib/supabaseClient';

export const PeopleOverviewWrapper = (props: {
  initialProfiles: UserWithExtras[];
  initialOfficeStatus?: boolean;
}) => {
  const [officeStatus, setOfficeStatus] = useState(props.initialOfficeStatus || false);
  const [profiles, setProfiles] = useState(props.initialProfiles || []);

  const refetchProfiles = useCallback(async () => {
    const users = await getAllUsersAction();
    if (users) {
      setProfiles(users);
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel('status-sync')
      .on('broadcast', { event: 'status_updated' }, () => {
        refetchProfiles();
      })
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [refetchProfiles]);

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
