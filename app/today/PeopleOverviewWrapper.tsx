'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { UserWithExtras } from '@/db/types';
import { getAllUsersAction } from '../actions/userActions';
import { supabase } from '@/lib/supabaseClient';
import { OfficeDashboard } from '@/components/office/OfficeDashboard';
import { isInOffice, personName } from '@/components/office/PeoplePanel';

export const PeopleOverviewWrapper = ({
  initialProfiles,
  userId,
  dateLabel,
}: {
  initialProfiles: UserWithExtras[];
  userId: string;
  dateLabel: string;
}) => {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [currentDateLabel, setCurrentDateLabel] = useState(dateLabel);
  const [arrival, setArrival] = useState<string | null>(null);
  const [syncError, setSyncError] = useState(false);
  const previous = useRef(initialProfiles);
  const pending = useRef(false);
  const mounted = useRef(false);
  const arrivalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refetchProfiles = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    try {
      const users = await getAllUsersAction();
      if (!mounted.current || !users) return;
      const before = new Set(previous.current.filter(isInOffice).map((person) => person.userId));
      const arrivals = users.filter((person) => isInOffice(person) && !before.has(person.userId));
      if (arrivals.length) {
        setArrival(
          arrivals.length === 1
            ? `${personName(arrivals[0])} is now in office`
            : `${arrivals.length} people are now in office`
        );
        if (arrivalTimer.current) clearTimeout(arrivalTimer.current);
        arrivalTimer.current = setTimeout(() => setArrival(null), 7000);
      }
      previous.current = users;
      setProfiles(users);
      setCurrentDateLabel(
        new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Europe/Copenhagen',
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        }).format(new Date())
      );
      setSyncError(false);
    } catch {
      if (mounted.current) setSyncError(true);
    } finally {
      pending.current = false;
    }
  }, []);

  // Synchronize server attendance with broadcasts, the clock, and browser visibility.
  useEffect(() => {
    mounted.current = true;
    const refresh = () => {
      if (document.visibilityState === 'visible') void refetchProfiles();
    };
    const channel = supabase
      ?.channel('status-sync')
      .on('broadcast', { event: 'status_updated' }, refresh)
      .subscribe();
    const timer = window.setInterval(refresh, 15_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      mounted.current = false;
      clearInterval(timer);
      if (arrivalTimer.current) clearTimeout(arrivalTimer.current);
      document.removeEventListener('visibilitychange', refresh);
      if (channel) void supabase?.removeChannel(channel);
    };
  }, [refetchProfiles]);
  return (
    <OfficeDashboard
      profiles={profiles}
      userId={userId}
      dateLabel={currentDateLabel}
      arrival={arrival}
      syncError={syncError}
      onStatusSaved={() => void refetchProfiles()}
    />
  );
};
