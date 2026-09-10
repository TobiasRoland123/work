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

  useEffect(() => {
    // Synchronize with server data and browser visibility. Local development has
    // no broadcast service; production also polls for timed status transitions.
    let pending = false;
    const refresh = async () => {
      if (document.visibilityState !== 'visible' || pending) return;
      pending = true;
      try {
        await refetchProfiles();
      } catch (error) {
        console.error('Unable to refresh attendance', error);
      } finally {
        pending = false;
      }
    };
    const timer = window.setInterval(
      refresh,
      process.env.NODE_ENV === 'development' ? 3_000 : 60_000
    );
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [refetchProfiles]);

  function getProfilesInAndOutOfOffice(profiles: Array<UserWithExtras>) {
    const profilesInOffice: UserWithExtras[] = [];
    const profilesOutOfOffice: UserWithExtras[] = [];

    profiles.forEach((profile) => {
      const approximate = profile.status?.startsAtApproximate || profile.status?.endsAtApproximate;
      const actionTime =
        profile.status?.time && !approximate ? new Date(profile.status.time).getTime() : null;
      const now = Date.now();
      if (
        profile.status === null ||
        profile.status?.status === 'IN_OFFICE' ||
        (profile.status?.status === 'IN_LATE' && actionTime !== null && actionTime < now) ||
        (profile.status?.status === 'LEAVING_EARLY' && actionTime !== null && actionTime > now)
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
