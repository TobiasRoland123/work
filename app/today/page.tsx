import { requirePageUserId } from '@/lib/auth/require-user';
import { userService } from '@/lib/services/userService';
import { statusService } from '@/lib/services/statusService';
import { copenhagenDate } from '@/lib/status/active';
import { parseWorkWeekStart, workWeekDays, workWeekStart } from '@/lib/status/week';
import { WeekOverviewWrapper } from './WeekOverviewWrapper';

export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string | string[] }>;
}) {
  const userId = await requirePageUserId();
  const { week } = await searchParams;
  const now = new Date();
  const today = copenhagenDate(now);
  const weekStart = parseWorkWeekStart(week, now);
  const days = workWeekDays(weekStart);
  const [users, plans] = await Promise.all([
    userService.getAllUsers(false, days),
    statusService.getUpcomingStatusesByUserUserId(userId),
  ]);

  return (
    <WeekOverviewWrapper
      key={weekStart}
      initialProfiles={users}
      userId={userId}
      weekStart={weekStart}
      currentWeekStart={workWeekStart(today)}
      days={days}
      today={today}
      initialPlans={plans}
    />
  );
}
