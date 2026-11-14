import React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import type { AttendanceTotals, ComparisonReason, PersonalStats } from '@/lib/personal-stats/types';
import { AttendanceChart } from './AttendanceChart';
import { CompanyComparison, ReportingPeriod } from './controls';
import './personal-stats.css';

const percent = (value: number | null) => (value === null ? 'N/A' : `${Math.round(value * 100)}%`);
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
const unitLabel = { day: 'Daily', week: 'Weekly', month: 'Monthly' };

export function comparisonExplanation(reason: ComparisonReason): string {
  if (reason === 'small-cohort')
    return 'Hidden to protect privacy: fewer than 4 other employees have recorded working days.';
  if (reason === 'low-coverage')
    return 'Hidden because your recorded coverage or company recorded coverage is below 80%.';
  if (reason === 'no-working-days')
    return 'Unavailable because there are no recorded working days to compare.';
  if (reason === 'off') return 'Company comparison is off.';
  return 'Company average is available.';
}

function ComparisonValue({ share, reason }: { share: number | null; reason: ComparisonReason }) {
  return share === null ? (
    <details className="personal-reason">
      <summary>
        Hidden<span className="sr-only">. Show reason for unavailable company average</span>
      </summary>
      <p>{comparisonExplanation(reason)}</p>
    </details>
  ) : (
    <>{percent(share)}</>
  );
}

function TotalsCells({ totals }: { totals: AttendanceTotals }) {
  return (
    <>
      <td>{totals.office}</td>
      <td>{totals.working}</td>
      <td className="personal-share">{percent(totals.officeShare)}</td>
    </>
  );
}

export function PersonalStatsDashboard({ data }: { data: PersonalStats }) {
  const { totals, comparison } = data;
  const period = `${dateLabel(data.startDate)} – ${dateLabel(data.endDate)}`;
  const missing = totals.unknown + totals.assumed;
  const hiddenBuckets = data.series.filter((point) => point.companyShare === null).length;

  return (
    <main id="dashboard-main" className="content-page personal-stats-page">
      <PageHeader
        title="Attendance trends"
        subtitle="See how your office routine changes over time."
        actions={<ReportingPeriod range={data.range} comparison={comparison} />}
      />
      <div className="content-page-body personal-stats-body">
        <p className="personal-period-caption">
          {period} <span>· Eligible weekdays</span>
        </p>
        <div className="personal-stats-summary" aria-label="Your attendance summary">
          <section
            className="personal-stat personal-stat-primary"
            aria-labelledby="personal-office-share"
          >
            <h2 id="personal-office-share">Your office share</h2>
            <p className="personal-stat-number">{percent(totals.officeShare)}</p>
            <p className="personal-stat-note">
              {totals.office} of {totals.working} recorded working days
            </p>
          </section>
          <section className="personal-stat" aria-labelledby="personal-office-days">
            <h2 id="personal-office-days">Office days</h2>
            <p className="personal-stat-number">{totals.office}</p>
            <p className="personal-stat-note">
              {totals.remote} remote · {totals.client} client{' '}
              {totals.client === 1 ? 'visit' : 'visits'}
            </p>
          </section>
          <section className="personal-stat" aria-labelledby="personal-coverage">
            <h2 id="personal-coverage">Recorded coverage</h2>
            <p className="personal-stat-number">{percent(totals.coverage)}</p>
            <p className="personal-stat-note">
              {totals.recorded} of {totals.eligible} eligible weekdays recorded
            </p>
          </section>
        </div>

        <section className="personal-card" aria-labelledby="personal-trend-heading">
          <div className="personal-card-head">
            <div>
              <h2 id="personal-trend-heading">Office share over time</h2>
              <p>
                {unitLabel[data.granularity]} · {period}
              </p>
            </div>
            <div className="personal-legend" aria-label="Chart legend">
              <span>
                <i aria-hidden="true" />
                You
              </span>
              {comparison && (
                <span>
                  <i className="personal-company-key" aria-hidden="true" />
                  Company average
                </span>
              )}
            </div>
          </div>
          <AttendanceChart points={data.series} comparison={comparison} />
          <div className="personal-chart-footer">
            <p>Share of recorded working days. Away and unrecorded days excluded.</p>
            <CompanyComparison range={data.range} comparison={comparison} />
          </div>
          {comparison && data.company.comparisonReason !== null && (
            <p className="personal-comparison-notice">
              {comparisonExplanation(data.company.comparisonReason)}
            </p>
          )}
          {comparison && hiddenBuckets > 0 && (
            <p className="personal-comparison-notice">
              {hiddenBuckets} {hiddenBuckets === 1 ? 'period has' : 'periods have'} no company
              comparison. Gaps stay visible in the chart; the table explains each hidden value.
            </p>
          )}
        </section>

        <section
          className="personal-card personal-table-card"
          aria-labelledby="personal-table-heading"
        >
          <div className="personal-card-head">
            <div>
              <h2 id="personal-table-heading">The numbers behind the line</h2>
              <p>Working days include office, remote and client visits.</p>
            </div>
            {comparison && <span className="personal-tag">Provisional comparison</span>}
          </div>
          <div
            className="personal-table-wrap"
            tabIndex={0}
            role="region"
            aria-label="Attendance trend values"
          >
            <table>
              <caption className="sr-only">
                Exact attendance values for {period}. N/A means no recorded working days. Hidden
                company values include their reason.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Period</th>
                  <th scope="col">Your office days</th>
                  <th scope="col">Your working days</th>
                  <th scope="col">Your share</th>
                  {comparison && <th scope="col">Company average</th>}
                </tr>
              </thead>
              <tbody>
                {data.series.map((point) => (
                  <tr key={point.key}>
                    <th scope="row" title={point.title}>
                      {point.label}
                    </th>
                    <TotalsCells totals={point.totals} />
                    {comparison && (
                      <td>
                        <ComparisonValue
                          share={point.companyShare}
                          reason={point.comparisonReason}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  <TotalsCells totals={totals} />
                  {comparison && (
                    <td>
                      <ComparisonValue
                        share={data.company.officeShare}
                        reason={data.company.comparisonReason}
                      />
                    </td>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <aside className="personal-history" aria-label="Coverage and history notice">
          <span className="personal-info" aria-hidden="true">
            i
          </span>
          <div>
            <p>
              {missing} eligible {missing === 1 ? 'weekday has' : 'weekdays have'} no recorded
              status. Your recorded status includes {totals.away} away{' '}
              {totals.away === 1 ? 'day' : 'days'}.
            </p>
            <p>
              Recorded coverage measures saved statuses, including away. Slack history import
              completeness is unverified
              {comparison ? ', so company comparisons are provisional' : ''}.
            </p>
          </div>
        </aside>
        <details className="personal-methodology">
          <summary>Calculation and comparison details</summary>
          <p>
            Your office share is office days divided by recorded working days.{' '}
            {totals.working > 0
              ? `${totals.office} ÷ ${totals.working} = ${percent(totals.officeShare)} for this period.`
              : 'There are no recorded working days in this period, so your share is N/A.'}{' '}
            Working days include office, remote and client visits. Away, missing statuses and
            assumed office defaults are excluded.
          </p>
          <p>
            Recorded coverage is recorded statuses divided by eligible weekdays, including away
            statuses.{' '}
            {totals.assumed > 0 &&
              `${totals.assumed} assumed office ${totals.assumed === 1 ? 'default is' : 'defaults are'} excluded from recorded attendance. `}
            A missing status never counts as office attendance. Coverage cannot confirm whether all
            Slack history has been imported.
          </p>
          <p>
            Company average pools office days and recorded working days from other active employees
            on the same weekdays. You are excluded. Each period and the total need at least 4
            contributing employees and at least 80% recorded coverage for both you and the company.
            Otherwise that comparison is hidden.
          </p>
          <p>
            Totals use pooled days rather than an average of chart percentages. Values are rounded
            for display. Today is included after 09:00 Copenhagen time and uses your current
            status. Earlier weekdays use the status at 09:00. Future dates and weekends are
            excluded.
          </p>
        </details>
        <footer className="personal-footer">
          <span>Personal insights · No individual colleague data</span>
          <span>{totals.eligible} eligible weekdays</span>
        </footer>
      </div>
    </main>
  );
}
