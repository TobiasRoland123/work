import { unstable_cache } from 'next/cache';
import type { Status } from '@/db/types';
import { userService } from './userService';
import { WEEK_OVERVIEW_TAG } from './weekOverviewCache';

const readWeekOverview = unstable_cache(
  (days: readonly string[]) => userService.getAllUsers(false, days),
  ['week-overview-v1'],
  { revalidate: 300, tags: [WEEK_OVERVIEW_TAG] }
);

function restoreStatusDates(value: Status | null): Status | null {
  if (!value) return value;
  return {
    ...value,
    time: value.time ? new Date(value.time) : null,
    startsAt: value.startsAt ? new Date(value.startsAt) : null,
    endsAt: value.endsAt ? new Date(value.endsAt) : null,
    announcedAt: value.announcedAt ? new Date(value.announcedAt) : null,
  };
}

/** Shared board data only. Authenticate callers before entering this query. */
export async function getWeekOverview(days: readonly string[]) {
  const profiles = await readWeekOverview(days);
  // Next's Data Cache serializes dates as strings. Keep misses and hits identical.
  return profiles.map((profile) => ({
    ...profile,
    status: restoreStatusDates(profile.status),
    ...(profile.week && {
      week: profile.week.map((day) => ({
        ...day,
        status: restoreStatusDates(day.status),
        announcement: restoreStatusDates(day.announcement ?? null),
      })),
    }),
  }));
}
