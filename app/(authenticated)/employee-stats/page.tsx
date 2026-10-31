import React from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { requirePageUserId } from '@/lib/auth/require-user';
import { isEmployeeStatsAdmin, requireEmployeeStatsViewer } from '@/lib/auth/employee-stats';
import { getEmployeeStats } from '@/lib/employee-stats/service';
import {
  ATTENDANCE_GROUPS,
  absenceDays,
  officeShare,
  personDays,
} from '@/lib/employee-stats/stats';
import type { EmployeeSort, EmployeeStatsRange } from '@/lib/employee-stats/stats';
import {
  RANGE_HEADINGS,
  WEEKDAY_NAMES,
  average,
  count,
  fullDayLabel,
  percent,
  share,
} from '@/lib/employee-stats/format';
import {
  AttendanceColumns,
  Legend,
  SegmentBar,
  TrendChart,
  TrendLegend,
  WeekdayBars,
  weekdayBars,
} from './charts';
import { RangeNav, StatsTabs } from './controls';
import './employee-stats.css';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ days?: string | string[]; sort?: string | string[] }>;

const one = (value: string | string[] | undefined) =>
  typeof value === 'string' ? value : undefined;

const statsUrl = (range: EmployeeStatsRange, sort: EmployeeSort) =>
  `/employee-stats?days=${range}${sort === 'name' ? '' : `&sort=${sort}`}`;

const granularityName = { day: 'day', week: 'week', month: 'month' } as const;

function BreakdownRow({
  group,
  label,
  days,
  total,
}: {
  group: string;
  label: string;
  days: number;
  total: number;
}) {
  const fraction = share(days, total);
  return (
    <li>
      <div>
        <span>{label}</span>
        <strong>{count.format(days)}</strong>
        <small>{percent(fraction)}</small>
      </div>
      <span className="stats-bar" aria-hidden="true">
        <span data-group={group} style={{ width: `${(fraction ?? 0) * 100}%` }} />
      </span>
    </li>
  );
}

export default async function EmployeeStatsPage({ searchParams }: { searchParams: SearchParams }) {
  const userId = await requirePageUserId();
  await requireEmployeeStatsViewer();
  const params = await searchParams;
  const [data, isAdmin] = await Promise.all([
    getEmployeeStats({ days: one(params.days), sort: one(params.sort) }),
    isEmployeeStatsAdmin(userId),
  ]);
  const { totals, employees, weekdays, series, spread } = data;
  const allPersonDays = personDays(totals);
  const periodUnit = granularityName[data.granularity];
  const employeeUrl = (id: string) => `/employee-stats/people/${id}?days=${data.range}`;

  return (
    <main id="dashboard-main" className="content-page stats-page">
      <PageHeader
        title="Employee stats"
        subtitle="Where people worked, based on announced and default attendance"
        actions={
          isAdmin ? (
            <Link href="/admin/roles" className="stats-header-link">
              Manage roles
            </Link>
          ) : undefined
        }
      />
      <div className="content-page-body stats-body">
        <StatsTabs current="overview" />
        <section aria-labelledby="stats-period-heading" className="stats-section">
          <div className="stats-heading-row">
            <div>
              <h2 id="stats-period-heading">{RANGE_HEADINGS[String(data.range)]}</h2>
              <p>
                {fullDayLabel(data.startDate)} – {fullDayLabel(data.endDate)} · {data.workdays}{' '}
                {data.workdays === 1 ? 'workday' : 'workdays'} · Copenhagen time
              </p>
            </div>
            <RangeNav current={data.range} href={(range) => statsUrl(range, data.sort)} />
          </div>

          <div className="stats-summary" aria-label="Period totals">
            <div>
              <span>Employees</span>
              <strong>{count.format(employees.length)}</strong>
              <small>Active in Slack</small>
            </div>
            <div>
              <span>Office share</span>
              <strong>{percent(officeShare(totals.counts))}</strong>
              <small>Of days in office, home or at a client</small>
            </div>
            <div>
              <span>In office per day</span>
              <strong>{average(totals.counts.office, data.workdays)}</strong>
              <small>Average people</small>
            </div>
            <div>
              <span>Absence</span>
              <strong>{percent(share(absenceDays(totals.counts), allPersonDays))}</strong>
              <small>{count.format(absenceDays(totals.counts))} sick, vacation or leave days</small>
            </div>
          </div>
        </section>

        {employees.length === 0 || data.workdays === 0 ? (
          <p className="stats-empty">
            {employees.length === 0
              ? 'No active employees were found.'
              : 'No workdays have started in this period yet.'}
          </p>
        ) : (
          <>
            <section aria-labelledby="stats-time-heading" className="stats-section stats-panel">
              <div className="stats-panel-head">
                <h2 id="stats-time-heading">Attendance over time</h2>
                <p className="stats-muted">
                  How everyone’s days were spent, by {periodUnit}. Each column adds up to 100%.
                </p>
              </div>
              <div className="stats-chart-scroll">
                <AttendanceColumns
                  series={series}
                  label={`Attendance by ${periodUnit}, ${RANGE_HEADINGS[String(data.range)].toLowerCase()}`}
                />
              </div>
              <Legend />
            </section>

            <section aria-labelledby="stats-trend-heading" className="stats-section stats-panel">
              <div className="stats-panel-head">
                <h2 id="stats-trend-heading">Office share over time</h2>
                <p className="stats-muted">
                  The share of working days spent in the office, by {periodUnit}. The shaded band is
                  where the middle half of employees were.
                </p>
              </div>
              <div className="stats-chart-scroll">
                <TrendChart
                  buckets={series.map((point) => point.bucket)}
                  lines={[
                    {
                      key: 'primary',
                      label: 'Company office share',
                      values: series.map((point) => officeShare(point.counts)),
                    },
                  ]}
                  spread={spread}
                  label={`Office share by ${periodUnit}`}
                />
              </div>
              <TrendLegend primary="Company office share" band />
            </section>

            <div className="stats-columns">
              <section aria-labelledby="stats-where-heading" className="stats-section stats-panel">
                <h2 id="stats-where-heading">Where people were</h2>
                <ul className="stats-breakdown">
                  {ATTENDANCE_GROUPS.map(({ key, label }) => (
                    <BreakdownRow
                      key={key}
                      group={key}
                      label={label}
                      days={totals.counts[key]}
                      total={allPersonDays}
                    />
                  ))}
                  {totals.noStatus > 0 && (
                    <BreakdownRow
                      group="none"
                      label="No status"
                      days={totals.noStatus}
                      total={allPersonDays}
                    />
                  )}
                </ul>
                <p className="stats-muted">Counted in person-days: one person on one workday.</p>
              </section>

              <section
                aria-labelledby="stats-weekday-heading"
                className="stats-section stats-panel"
              >
                <h2 id="stats-weekday-heading">By weekday</h2>
                <WeekdayBars items={weekdayBars(weekdays)} label="Office share on each weekday" />
                <div className="stats-table-scroll">
                  <table className="stats-table">
                    <thead>
                      <tr>
                        <th scope="col">Day</th>
                        <th scope="col">In office</th>
                        <th scope="col">Home &amp; remote</th>
                        <th scope="col">At client</th>
                        <th scope="col">Absent</th>
                        <th scope="col">Office share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weekdays.map((day) => (
                        <tr key={day.weekday}>
                          <th scope="row">{WEEKDAY_NAMES[day.weekday - 1]}</th>
                          <td>{average(day.counts.office, day.days)}</td>
                          <td>{average(day.counts.remote, day.days)}</td>
                          <td>{average(day.counts.client, day.days)}</td>
                          <td>{average(absenceDays(day.counts), day.days)}</td>
                          <td>{percent(officeShare(day.counts))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="stats-muted">
                  Bars show the office share; the table gives the average number of people per
                  weekday in the period.
                </p>
              </section>
            </div>

            <section aria-labelledby="stats-people-heading" className="stats-section stats-panel">
              <h2 id="stats-people-heading">By employee</h2>
              <div className="stats-table-scroll">
                <table className="stats-table stats-people">
                  <thead>
                    <tr>
                      <th scope="col" aria-sort={data.sort === 'name' ? 'ascending' : undefined}>
                        <Link href={statsUrl(data.range, 'name')}>Employee</Link>
                      </th>
                      {ATTENDANCE_GROUPS.map(({ key, label }) => (
                        <th
                          key={key}
                          scope="col"
                          aria-sort={data.sort === key ? 'descending' : undefined}
                        >
                          <Link href={statsUrl(data.range, key)}>{label}</Link>
                        </th>
                      ))}
                      <th scope="col">Office share</th>
                      <th scope="col">Split</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((employee) => (
                      <tr key={employee.userId}>
                        <th scope="row">
                          <Link href={employeeUrl(employee.userId)} className="stats-person-link">
                            {employee.name}
                          </Link>
                          {employee.name !== employee.email && <small>{employee.email}</small>}
                        </th>
                        {ATTENDANCE_GROUPS.map(({ key }) => (
                          <td key={key}>{count.format(employee.counts[key])}</td>
                        ))}
                        <td>{percent(officeShare(employee.counts))}</td>
                        <td>
                          <SegmentBar days={employee} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="stats-muted">Select an employee to see their own charts.</p>
            </section>
          </>
        )}

        <p className="stats-note">
          Each workday is read the way the Week page reads it at 09:00 Copenhagen time, so days
          without an announcement count as in the office. Today is included once it has started.
          Everyone is counted from the day they joined or first announced something. Office share
          leaves out sick days, vacation, leave and days without a status. Sick days are sensitive:
          only people the admin has chosen can see this page.
        </p>
      </div>
    </main>
  );
}
