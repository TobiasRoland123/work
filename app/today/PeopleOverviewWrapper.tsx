'use client';
import PeopleOverview from '@/components/ui/PeopleOverview/PeopleOverview';
import { useCallback } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';

import { UserWithExtras } from '@/db/types';
import { useState } from 'react';
import { getAllUsersAction } from '../actions/userActions';

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
  const wsUrl =
    process.env.NODE_ENV === 'production' ? process.env.NEXT_PUBLIC_WS_URL! : 'ws://localhost:3001';

  useWebSocket(wsUrl, handleMessage);

  const filteredProfiles = officeStatus
    ? profiles.filter((profile) => profile.status?.status === 'IN_OFFICE')
    : profiles.filter(
        (profile) => profile.status?.status && profile.status?.status !== 'IN_OFFICE'
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
