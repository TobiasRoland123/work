'use client';
import PeopleOverview from '@/components/ui/PeopleOverview/PeopleOverview';
import { useCallback, useEffect, useState } from 'react';
import { UserWithExtras } from '@/db/types';
import { getAllUsersAction } from '../actions/userActions';
import { supabase } from '@/lib/supabaseClient';
import { useWebSocket } from '@/hooks/useWebSocket';

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

  const handleMessage = useCallback(
    (msg: string) => {
      try {
        const data = JSON.parse(msg);
        if (data.type === 'STATUS_UPDATE' || data.type === 'USER_UPDATE') {
          refetchProfiles();
        }
      } catch (e) {
        console.error(e);
      }
    },
    [refetchProfiles]
  );
  const wsUrl = 'ws://localhost:3001';

  useWebSocket(wsUrl, handleMessage);

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

  useEffect(() => {
    const main = document.getElementById('dashboard-main');
    if (main) {
      main.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [officeStatus]);

  return (
    <PeopleOverview
      profiles={officeStatus ? profilesInOffice : profilesOutOfOffice}
      officeStatus={officeStatus}
      setOfficeStatus={setOfficeStatus}
      showStatus
    />
  );
};
