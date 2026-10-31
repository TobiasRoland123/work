'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { UserWithExtras } from '@/db/types';
import { getWeekOverviewAction } from '@/app/actions/userActions';
import { getMyUpcomingStatusesAction } from '@/app/actions/statusActions';
import { pinColleagueAction, unpinColleagueAction } from '@/app/actions/pinActions';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { copenhagenDate } from '@/lib/status/active';
import {
  addDays,
  resolveWeekView,
  shiftWorkWeek,
  workWeekDays,
  workWeekStart,
} from '@/lib/status/week';
import type { UpcomingStatus } from '@/lib/status/plan';
import { WeekOverview } from '@/components/week/WeekOverview';
import { isInOffice, personName } from '@/components/week/presence';

/** `week` is a work week's Monday; without it the view is one day, and no day means today. */
type View = { week?: string; day?: string };

const sameView = (a: View, b: View) => a.week === b.week && a.day === b.day;
const viewKey = (view: View, today: string) =>
  view.week ? `week:${view.week}` : `day:${view.day ?? today}`;

function viewFromHref(href: string): View | null {
  const url = new URL(href, window.location.origin);
  if (url.pathname !== '/today') return null;
  return resolveWeekView({
    week: url.searchParams.get('week'),
    day: url.searchParams.get('day'),
  });
}

export const WeekOverviewWrapper = ({
  initialProfiles,
  userId,
  weekStart,
  days,
  day,
  today: initialToday,
  initialPlans,
  initialPinnedIds,
  initialPanelOpen = true,
}: {
  initialProfiles: UserWithExtras[];
  userId: string;
  weekStart: string;
  days: string[];
  day?: string;
  today: string;
  initialPlans: UpcomingStatus[];
  initialPinnedIds: string[];
  initialPanelOpen?: boolean;
}) => {
  const [initialView] = useState<View>(() => ({
    week: days.length === 1 ? undefined : weekStart,
    day,
  }));
  const [view, setView] = useState(initialView);
  const [loadedKey, setLoadedKey] = useState(() => viewKey(initialView, initialToday));
  const [panelOpen, setPanelOpen] = useState(initialPanelOpen);
  const [profiles, setProfiles] = useState(initialProfiles);
  const [plans, setPlans] = useState(initialPlans);
  const [pinnedIds, setPinnedIds] = useState(initialPinnedIds);
  const [today, setToday] = useState(initialToday);
  const [arrival, setArrival] = useState<string | null>(null);
  const [syncError, setSyncError] = useState(false);
  const viewRef = useRef(initialView);
  const todayRef = useRef(initialToday);
  // Attendance already fetched per view, so revisiting one shows it before the refresh lands.
  const cache = useRef(new Map([[viewKey(initialView, initialToday), initialProfiles]]));
  const inflight = useRef(new Map<string, Promise<UserWithExtras[] | undefined>>());
  const previous = useRef(initialProfiles);
  const pending = useRef(false);
  const mounted = useRef(false);
  const arrivalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateToday = useCallback((date: string) => {
    todayRef.current = date;
    setToday(date);
  }, []);

  const fetchView = useCallback((target: View) => {
    const key = viewKey(target, todayRef.current);
    let request = inflight.current.get(key);
    if (!request) {
      request = getWeekOverviewAction(target.week, target.day)
        .then((users) => {
          // The server resolved "today" itself, so file it under the date it is now.
          if (users) cache.current.set(viewKey(target, copenhagenDate()), users);
          return users;
        })
        .finally(() => inflight.current.delete(key));
      inflight.current.set(key, request);
    }
    return request;
  }, []);

  const refetchProfiles = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    const target = viewRef.current;
    try {
      const [users, upcoming] = await Promise.all([
        fetchView(target),
        getMyUpcomingStatusesAction(),
      ]);
      if (!mounted.current || !users) return;
      setPlans(upcoming);
      // The visitor may have moved on while this was loading; that move applies its own data.
      if (!sameView(viewRef.current, target)) return;
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
      const now = copenhagenDate();
      previous.current = users;
      setProfiles(users);
      updateToday(now);
      setLoadedKey(viewKey(target, now));
      setSyncError(false);
    } catch {
      if (mounted.current) setSyncError(true);
    } finally {
      pending.current = false;
    }
  }, [fetchView, updateToday]);

  // Switching day or week updates the page at once. Cached attendance is shown immediately and
  // refreshed; otherwise placeholders stand in until the server answers.
  const show = useCallback(
    (next: View, fallbackHref: string) => {
      viewRef.current = next;
      setView(next);
      const key = viewKey(next, todayRef.current);
      const apply = (users: UserWithExtras[]) => {
        if (!mounted.current || !sameView(viewRef.current, next)) return;
        previous.current = users;
        setProfiles(users);
        setLoadedKey(key);
        setSyncError(false);
      };
      const cached = cache.current.get(key);
      if (cached) apply(cached);
      fetchView(next)
        .then((users) => users && apply(users))
        .catch(() => {
          if (!mounted.current || !sameView(viewRef.current, next)) return;
          if (cached) setSyncError(true);
          else window.location.assign(fallbackHref);
        });
    },
    [fetchView]
  );

  const navigate = useCallback(
    (href: string) => {
      const next = viewFromHref(href);
      if (!next) return window.location.assign(href);
      if (href !== window.location.pathname + window.location.search) {
        window.history.pushState(null, '', href);
      }
      show(next, href);
    },
    [show]
  );

  const prefetchView = useCallback(
    (next: View) => {
      if (cache.current.has(viewKey(next, todayRef.current))) return Promise.resolve();
      return fetchView(next).then(
        () => undefined,
        () => undefined
      );
    },
    [fetchView]
  );

  const prefetch = useCallback(
    (href: string) => {
      const next = viewFromHref(href);
      if (next) void prefetchView(next);
    },
    [prefetchView]
  );

  // Pins change instantly and roll back when the server refuses them. They are not polled, so
  // the list cannot flicker back to an older state while a change is on its way.
  const changePin = useCallback(async (colleagueUserId: string, pinned: boolean) => {
    const add = (ids: string[]) =>
      ids.includes(colleagueUserId) ? ids : [...ids, colleagueUserId];
    const remove = (ids: string[]) => ids.filter((id) => id !== colleagueUserId);
    setPinnedIds(pinned ? add : remove);
    try {
      const result = await (pinned ? pinColleagueAction : unpinColleagueAction)(colleagueUserId);
      if (!result.ok) throw new Error(result.error);
    } catch (error) {
      setPinnedIds(pinned ? remove : add);
      toast(error instanceof Error ? error.message : 'Could not update your pinned colleagues 🚫');
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
    const onPopState = () => {
      const next = viewFromHref(window.location.href);
      if (next && !sameView(next, viewRef.current)) show(next, window.location.href);
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      mounted.current = false;
      clearInterval(timer);
      if (arrivalTimer.current) clearTimeout(arrivalTimer.current);
      document.removeEventListener('visibilitychange', refresh);
      if (channel) void supabase?.removeChannel(channel);
    };
  }, [refetchProfiles, show]);

  const todayOnly = !view.week;
  const viewDays = view.week ? workWeekDays(view.week) : [view.day ?? today];
  const loading = loadedKey !== viewKey(view, today);

  // Once the current view is on screen, quietly fetch every view its buttons lead to, one at a
  // time and only when the browser is idle, so the next click is usually answered from the cache.
  useEffect(() => {
    if (loading) return;
    const targets: View[] = view.week
      ? [
          { week: shiftWorkWeek(view.week, 1) },
          { week: shiftWorkWeek(view.week, -1) },
          {},
          { week: workWeekStart(todayRef.current) },
        ]
      : [
          { day: addDays(viewDays[0], 1) },
          { day: addDays(viewDays[0], -1) },
          { week: workWeekStart(todayRef.current) },
          {},
        ];
    let cancelled = false;
    const run = async () => {
      for (const target of targets) {
        if (cancelled || document.visibilityState !== 'visible') return;
        await prefetchView(target);
      }
    };
    const idle =
      window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 200));
    const cancelIdle = window.cancelIdleCallback ?? window.clearTimeout;
    const handle = idle(() => void run());
    return () => {
      cancelled = true;
      cancelIdle(handle);
    };
    // viewDays follows the view and today, both already covered by these dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, view, today, prefetchView]);
  return (
    <WeekOverview
      key={todayOnly ? viewDays[0] : view.week}
      profiles={profiles}
      userId={userId}
      days={viewDays}
      today={today}
      weekStart={view.week ?? workWeekStart(viewDays[0])}
      currentWeekStart={workWeekStart(today)}
      arrival={arrival}
      syncError={syncError}
      loading={loading}
      plans={plans}
      pinnedIds={pinnedIds}
      initialPanelOpen={panelOpen}
      onPanelChange={setPanelOpen}
      onNavigate={navigate}
      onPrefetch={prefetch}
      onPinChange={(id, pinned) => void changePin(id, pinned)}
      onStatusSaved={() => void refetchProfiles()}
    />
  );
};
