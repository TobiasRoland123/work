import React from 'react';
import type { AttendanceTotals, PersonalStatsWeekday } from '@/lib/personal-stats/types';
import { ComparisonValue, percent } from './comparison';
import './attendance-breakdown.css';

const categories = [
  { key: 'office', label: 'Office' },
  { key: 'remote', label: 'Home / remote' },
  { key: 'client', label: 'Client visit' },
  { key: 'away', label: 'Away' },
  { key: 'unknown', label: 'Unknown status' },
  { key: 'assumed', label: 'Assumed office' },
] as const;

function ShareBar({ share, company = false }: { share: number | null; company?: boolean }) {
  return (
    <span
      className="personal-weekday-track"
      data-unavailable={share === null || undefined}
      aria-hidden="true"
    >
      {share !== null && (
        <span
          className={
            company ? 'personal-weekday-fill personal-weekday-company' : 'personal-weekday-fill'
          }
          style={{ width: `${share * 100}%` }}
        />
      )}
    </span>
  );
}

export function AttendanceBreakdown({
  totals,
  weekdays,
  comparison,
}: {
  totals: AttendanceTotals;
  weekdays: PersonalStatsWeekday[];
  comparison: boolean;
}) {
  return (
    <div className="personal-breakdown-grid">
      <section className="personal-card personal-days-card" aria-labelledby="personal-days-heading">
        <div className="personal-card-head">
          <h2 id="personal-days-heading">Where your days went</h2>
          <p>{totals.eligible} weekdays</p>
        </div>
        <div className="personal-day-stack" aria-hidden="true">
          {categories.map(
            ({ key }) =>
              totals[key] > 0 && (
                <span
                  key={key}
                  data-category={key}
                  style={{ width: `${(totals[key] / totals.eligible) * 100}%` }}
                />
              )
          )}
        </div>
        {totals.eligible === 0 && (
          <p className="personal-breakdown-note">No eligible weekdays in this period.</p>
        )}
        <dl className="personal-day-list">
          {categories.map(({ key, label }) => (
            <div key={key} data-category={key}>
              <dt>
                <span className="personal-category-dot" aria-hidden="true" />
                {label}
              </dt>
              <dd>
                <strong>{totals[key]}</strong>
                <span>{totals[key] === 1 ? 'day' : 'days'}</span>
              </dd>
            </div>
          ))}
        </dl>
        <p className="personal-breakdown-note">
          Unknown status and assumed office days are excluded from recorded attendance.
        </p>
      </section>

      <section
        className="personal-card personal-weekdays-card"
        aria-labelledby="personal-weekdays-heading"
      >
        <div className="personal-card-head">
          <h2 id="personal-weekdays-heading">Your weekday pattern</h2>
          <p>Office share</p>
        </div>
        <div className="personal-weekday-legend" aria-label="Weekday chart legend">
          <span>
            <i aria-hidden="true" />
            You
          </span>
          {comparison && (
            <span>
              <i className="personal-weekday-company" aria-hidden="true" />
              Company average
            </span>
          )}
        </div>
        <ul className="personal-weekdays">
          {weekdays.map((day) => (
            <li key={day.weekday} aria-label={day.label}>
              <span className="personal-weekday-name">{day.label}</span>
              <div className="personal-weekday-values">
                <div className="personal-weekday-row">
                  <ShareBar share={day.totals.officeShare} />
                  <div className="personal-weekday-number">
                    <span className="sr-only">You: </span>
                    {percent(day.totals.officeShare)}
                  </div>
                </div>
                {comparison && (
                  <div className="personal-weekday-row" data-weekday-company>
                    <ShareBar share={day.companyShare} company />
                    <div className="personal-weekday-number">
                      <span className="sr-only">Company average: </span>
                      <ComparisonValue share={day.companyShare} reason={day.comparisonReason} />
                    </div>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
        <p className="personal-breakdown-note">
          Office days divided by recorded working days for each weekday. Small counts can move these
          percentages. N/A means no recorded working days.
        </p>
        {comparison && (
          <p className="personal-breakdown-note">
            Company comparisons are provisional. Each weekday must meet the coverage and contributor
            thresholds.
          </p>
        )}
      </section>
    </div>
  );
}
