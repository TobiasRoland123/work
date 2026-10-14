import { requirePageUserId } from '@/lib/auth/require-user';
import { userService } from '@/lib/services/userService';
import { statusService } from '@/lib/services/statusService';
import { copenhagenDate } from '@/lib/status/active';
import { parseDay, parseWorkWeekStart, workWeekDays, workWeekStart } from '@/lib/status/week';
import { WeekOverviewWrapper } from './WeekOverviewWrapper';

export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string | string[]; day?: string | string[] }>;
}) {
  const userId = await requirePageUserId();
  const { week, day: requestedDay } = await searchParams;
  const now = new Date();
  const today = copenhagenDate(now);
  const day = !week && requestedDay ? parseDay(requestedDay, now) : undefined;
  const weekStart = week ? parseWorkWeekStart(week, now) : workWeekStart(day ?? today);
  const days = week ? workWeekDays(weekStart) : [day ?? today];
  const [users, plans] = await Promise.all([
    userService.getAllUsers(false, days),
    statusService.getUpcomingStatusesByUserUserId(userId),
  ]);

  return (
    <WeekOverviewWrapper
      key={week ? `week:${weekStart}` : (day ?? 'today')}
      initialProfiles={users}
      userId={userId}
      weekStart={weekStart}
      currentWeekStart={workWeekStart(today)}
      days={days}
      day={day}
      today={today}
      initialPlans={plans}
    />
  );
}
