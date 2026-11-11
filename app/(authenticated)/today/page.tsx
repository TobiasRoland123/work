import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requirePageUserId } from '@/lib/auth/require-user';
import { isAdmin } from '@/lib/auth/roles';
import { getWeekOverview } from '@/lib/services/weekOverviewQuery';
import { statusService } from '@/lib/services/statusService';
import { pinService } from '@/lib/services/pinService';
import { copenhagenDate } from '@/lib/status/active';
import { parseDay, parseWorkWeekStart, workWeekDays, workWeekStart } from '@/lib/status/week';
import { WEEK_PANEL_COOKIE, isWeekPanelOpen } from '@/components/week/panelPreference';
import { WEEK_LAYOUT_COOKIE, weekLayout } from '@/components/week/layoutPreference';
import { WEEK_SCOPE_COOKIE, weekScope } from '@/components/week/scopePreference';
import { WeekOverviewWrapper } from './WeekOverviewWrapper';

export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string | string[]; day?: string | string[] }>;
}) {
  const userId = await requirePageUserId();
  const [{ week, day: requestedDay }, cookieStore] = await Promise.all([searchParams, cookies()]);
  const now = new Date();
  const today = copenhagenDate(now);
  // A plain visit opens the scope the visitor last looked at. Redirecting keeps the week in the
  // address, so back, forward and reload agree with what is on screen.
  if (!week && !requestedDay && weekScope(cookieStore.get(WEEK_SCOPE_COOKIE)?.value) === 'week') {
    redirect(`/today?week=${workWeekStart(today)}`);
  }
  const day = !week && requestedDay ? parseDay(requestedDay, now) : undefined;
  const weekStart = week ? parseWorkWeekStart(week, now) : workWeekStart(day ?? today);
  const days = week ? workWeekDays(weekStart) : [day ?? today];
  const [users, plans, pinnedIds, admin] = await Promise.all([
    getWeekOverview(days),
    statusService.getUpcomingStatusesByUserUserId(userId),
    pinService.listPinnedIds(userId),
    isAdmin(userId),
  ]);

  return (
    <WeekOverviewWrapper
      key={week ? `week:${weekStart}` : (day ?? 'today')}
      initialProfiles={users}
      userId={userId}
      weekStart={weekStart}
      days={days}
      day={day}
      today={today}
      initialPlans={plans}
      initialPinnedIds={pinnedIds}
      initialPanelOpen={isWeekPanelOpen(cookieStore.get(WEEK_PANEL_COOKIE)?.value)}
      initialLayout={weekLayout(cookieStore.get(WEEK_LAYOUT_COOKIE)?.value)}
      canSetColleagueStatus={admin}
    />
  );
}
