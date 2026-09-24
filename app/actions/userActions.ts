'use server';
import { userService } from '@/lib/services/userService';
import { requireUserId } from '@/lib/auth/require-user';
import { parseWorkWeekStart, workWeekDays } from '@/lib/status/week';

export async function getWeekOverviewAction(weekStart: string) {
  await requireUserId();
  return userService.getAllUsers(false, workWeekDays(parseWorkWeekStart(weekStart)));
}
