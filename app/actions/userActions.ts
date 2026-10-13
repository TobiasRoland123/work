'use server';
import { userService } from '@/lib/services/userService';
import { requireUserId } from '@/lib/auth/require-user';
import { copenhagenDate } from '@/lib/status/active';
import { parseWorkWeekStart, workWeekDays } from '@/lib/status/week';

export async function getWeekOverviewAction(weekStart?: string) {
  await requireUserId();
  const days = weekStart ? workWeekDays(parseWorkWeekStart(weekStart)) : [copenhagenDate()];
  return userService.getAllUsers(false, days);
}
