'use server';
import { getWeekOverview } from '@/lib/services/weekOverviewQuery';
import { requireUserId } from '@/lib/auth/require-user';
import { parseDay, parseWorkWeekStart, workWeekDays } from '@/lib/status/week';

export async function getWeekOverviewAction(weekStart?: string, day?: string) {
  await requireUserId();
  const days = weekStart ? workWeekDays(parseWorkWeekStart(weekStart)) : [parseDay(day)];
  return getWeekOverview(days);
}
