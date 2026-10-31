import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { requirePageUserId } from '@/lib/auth/require-user';
import { requireEmployeeStatsViewer } from '@/lib/auth/employee-stats';
import { getEmployeeProfile, listEmployees } from '@/lib/employee-stats/service';
import { absenceRate } from '@/lib/employee-stats/history';
import { workingDays, officeShare, absenceDays, personDays } from '@/lib/employee-stats/stats';
import type { EmployeeStatsRange } from '@/lib/employee-stats/stats';
import type { Comparison } from '@/lib/employee-stats/service';
import {
  RANGE_HEADINGS,
  count,
  fullDayLabel,
  percent,
  pointGap,
  share,
} from '@/lib/employee-stats/format';
import {
  AttendanceColumns,
  DayCalendar,
  GroupComparison,
  Legend,
  TrendChart,
  TrendLegend,
  WeekdayBars,
  weekdayBars,
} from '../../charts';
import { RangeNav, StatsTabs } from '../../controls';
import { PersonSearch } from '../../PersonSearch';
import '../../employee-stats.css';

export const dynamic = 'force-dynamic';

type Params = Promise<{ userId: string }>;
type SearchParams = Promise<{ days?: string | string[]; compare?: string | string[] }>;

const one = (value: string | string[] | undefined) =>
  typeof value === 'string' ? value : undefined;

const profileUrl = (userId: string, range: EmployeeStatsRange, compare: Comparison) =>
  `/employee-stats/people/${userId}?days=${range}&compare=${compare}`;

const granularityName = { day: 'day', week: 'week', month: 'month' } as const;

export default async function EmployeeProfilePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  await requirePageUserId();
  await requireEmployeeStatsViewer();
  const [{ userId }, query] = await Promise.all([params, searchParams]);
  const [data, people] = await Promise.all([
    getEmployeeProfile({ userId, days: one(query.days), compare: one(query.compare) }),
    listEmployees(),
  ]);
  if (!data) notFound();

  const { employee, person, norm, buckets, calendar, compare, range } = data;
  const series = person.series;
  const periodUnit = granularityName[data.granularity];
  const firstName = employee.name.split(' ')[0] ?? employee.name;
  const comparing = norm !== null;
  const hasDays = data.workdays.length > 0;

  const ownShare = officeShare(person.totals.counts);
  const normShare = norm ? officeShare(norm.totals.counts) : null;
  const ownRemote = share(person.totals.counts.remote, workingDays(person.totals.counts));
  const normRemote = norm
    ? share(norm.totals.counts.remote, workingDays(norm.totals.counts))
    : null;
  const ownAbsence = absenceRate(person.totals);
  const normAbsence = norm ? absenceRate(norm.totals) : null;
  const versus = (own: number | null, typical: number | null) =>
    comparing ? `Norm ${percent(typical)} · ${pointGap(own, typical) ?? 'no comparison'}` : null;

  return (
    <main id="dashboard-main" className="content-page stats-page">
      <PageHeader
        title={employee.name}
        subtitle={employee.email}
        actions={
          <Link href="/employee-stats/people" className="stats-header-link">
            All employees
          </Link>
        }
      />
      <div className="content-page-body stats-body">
        <StatsTabs current="employees" />
        <PersonSearch
          variant="compact"
          people={people}
          linkSuffix={`?days=${range}&compare=${compare}`}
        />

        <section aria-labelledby="stats-profile-heading" className="stats-section">
          <div className="stats-heading-row">
            <div>
              <h2 id="stats-profile-heading">{RANGE_HEADINGS[String(range)]}</h2>
              <p>
                {hasDays
                  ? `${fullDayLabel(data.workdays[0]!)} – ${fullDayLabel(data.endDate)} · ${data.workdays.length} ${
                      data.workdays.length === 1 ? 'workday' : 'workdays'
                    } on record · Copenhagen time`
                  : 'No workdays on record in this period'}
              </p>
            </div>
            <RangeNav current={range} href={(next) => profileUrl(userId, next, compare)} />
          </div>

          <div className="stats-view-row">
            <nav aria-label="Comparison" className="stats-periods">
              <Link
                href={profileUrl(userId, range, 'alone')}
                aria-current={compare === 'alone' ? 'page' : undefined}
              >
                {firstName} only
              </Link>
              <Link
                href={profileUrl(userId, range, 'norm')}
                aria-current={compare === 'norm' ? 'page' : undefined}
              >
                Against the norm
              </Link>
            </nav>
            {compare === 'norm' && !comparing && (
              <p className="stats-muted">There are no colleagues to compare with yet.</p>
            )}
          </div>

          <div className="stats-summary" aria-label={`${employee.name} totals`}>
            <div>
              <span>Workdays on record</span>
              <strong>{count.format(data.workdays.length)}</strong>
              <small>
                {hasDays ? `Since ${fullDayLabel(data.workdays[0]!)}` : 'Nothing in this period'}
              </small>
            </div>
            <div>
              <span>Office share</span>
              <strong>{percent(ownShare)}</strong>
              <small>
                {versus(ownShare, normShare) ?? 'Of days in office, home or at a client'}
              </small>
              {data.officeRank !== null && (
                <small>Ahead of {Math.round(data.officeRank * 100)}% of colleagues</small>
              )}
            </div>
            <div>
              <span>Home &amp; remote</span>
              <strong>{percent(ownRemote)}</strong>
              <small>
                {versus(ownRemote, normRemote) ?? 'Of days in office, home or at a client'}
              </small>
            </div>
            <div>
              <span>Absence</span>
              <strong>{percent(ownAbsence)}</strong>
              <small>
                {versus(ownAbsence, normAbsence) ??
                  `${count.format(absenceDays(person.totals.counts))} sick, vacation or leave days`}
              </small>
            </div>
          </div>
        </section>

        {!hasDays || personDays(person.totals) === 0 ? (
          <p className="stats-empty">
            {firstName} has no workdays on record in this period. Try a longer one.
          </p>
        ) : (
          <>
            <section aria-labelledby="stats-time-heading" className="stats-section stats-panel">
              <div className="stats-panel-head">
                <h2 id="stats-time-heading">Attendance over time</h2>
                <p className="stats-muted">
                  How {firstName}’s days were spent, by {periodUnit}. Each column adds up to 100%.
                </p>
              </div>
              <div className="stats-chart-scroll">
                <AttendanceColumns
                  series={series}
                  label={`${employee.name}’s attendance by ${periodUnit}`}
                />
              </div>
              <Legend />
            </section>

            <section aria-labelledby="stats-trend-heading" className="stats-section stats-panel">
              <div className="stats-panel-head">
                <h2 id="stats-trend-heading">Office share over time</h2>
                <p className="stats-muted">
                  The share of working days in the office, by {periodUnit}
                  {comparing ? ', against the norm of the other employees over the same days' : ''}.
                </p>
              </div>
              <div className="stats-chart-scroll">
                <TrendChart
                  buckets={buckets}
                  lines={[
                    {
                      key: 'primary',
                      label: employee.name,
                      values: series.map((point) => officeShare(point.counts)),
                    },
                    ...(norm
                      ? [
                          {
                            key: 'norm' as const,
                            label: 'Norm',
                            values: norm.series.map((point) => officeShare(point.counts)),
                          },
                        ]
                      : []),
                  ]}
                  spread={norm?.spread}
                  label={`${employee.name}’s office share by ${periodUnit}`}
                />
              </div>
              <TrendLegend
                primary={employee.name}
                norm={comparing ? `Norm (${norm.colleagues} colleagues)` : undefined}
                band={comparing && norm.spread.some(Boolean)}
              />
            </section>

            <div className="stats-columns">
              <section aria-labelledby="stats-where-heading" className="stats-section stats-panel">
                <h2 id="stats-where-heading">Where {firstName} was</h2>
                <GroupComparison person={person.totals} norm={norm?.totals ?? null} />
                <p className="stats-muted">
                  Share of all days in the period
                  {comparing ? '. The line on each bar is the norm' : ''}.
                </p>
              </section>

              <section
                aria-labelledby="stats-weekday-heading"
                className="stats-section stats-panel"
              >
                <h2 id="stats-weekday-heading">By weekday</h2>
                <WeekdayBars
                  items={weekdayBars(person.weekdays, norm?.weekdays)}
                  label={`${employee.name}’s office share on each weekday`}
                />
                <p className="stats-muted">
                  Office share on each weekday
                  {comparing ? '. The line on each bar is the norm' : ''}.
                </p>
              </section>
            </div>

            <section aria-labelledby="stats-calendar-heading" className="stats-section stats-panel">
              <div className="stats-panel-head">
                <h2 id="stats-calendar-heading">Day by day</h2>
                <p className="stats-muted">
                  One square per workday, a column per week
                  {data.workdays.length > calendar.length ? ' (the latest year)' : ''}.
                </p>
              </div>
              <div className="stats-chart-scroll">
                <DayCalendar cells={calendar} label={`${employee.name}’s attendance day by day`} />
              </div>
              <Legend />
            </section>
          </>
        )}

        <p className="stats-note">
          {comparing
            ? `The norm is all ${norm.colleagues} other active employees together, over the same workdays as ${firstName}, and it moves with them over time. The shaded band is where the middle half of them were in each ${periodUnit}, shown once at least four colleagues worked. `
            : 'This view shows only this person. '}
          {firstName} is counted from the day they joined or first announced something. Days without
          an announcement count as in the office, as on the Week page. Office share leaves out sick
          days, vacation, leave and days without a status.
        </p>
      </div>
    </main>
  );
}
