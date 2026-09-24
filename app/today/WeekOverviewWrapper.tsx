'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { UserWithExtras } from '@/db/types';
import { getWeekOverviewAction } from '../actions/userActions';
import { getMyUpcomingStatusesAction } from '../actions/statusActions';
import { supabase } from '@/lib/supabaseClient';
import { copenhagenDate } from '@/lib/status/active';
import type { UpcomingStatus } from '@/lib/status/plan';
import { WeekOverview } from '@/components/week/WeekOverview';
import { isInOffice, personName } from '@/components/week/presence';

export const WeekOverviewWrapper = ({
  initialProfiles,
  userId,
  weekStart,
  currentWeekStart,
  days,
  today: initialToday,
  initialPlans,
}: {
  initialProfiles: UserWithExtras[];
  userId: string;
  weekStart: string;
  currentWeekStart: string;
  days: string[];
  today: string;
  initialPlans: UpcomingStatus[];
}) => {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [plans, setPlans] = useState(initialPlans);
  const [today, setToday] = useState(initialToday);
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
      const [users, upcoming] = await Promise.all([
        getWeekOverviewAction(weekStart),
        getMyUpcomingStatusesAction(),
      ]);
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
      setPlans(upcoming);
      setToday(copenhagenDate());
      setSyncError(false);
    } catch {
      if (mounted.current) setSyncError(true);
    } finally {
      pending.current = false;
    }
  }, [weekStart]);

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
    <WeekOverview
      profiles={profiles}
      userId={userId}
      days={days}
      today={today}
      weekStart={weekStart}
      currentWeekStart={currentWeekStart}
      arrival={arrival}
      syncError={syncError}
      plans={plans}
      onStatusSaved={() => void refetchProfiles()}
    />
  );
};
