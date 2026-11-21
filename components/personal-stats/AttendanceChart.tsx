import React from 'react';
import type { PersonalStatsPoint } from '@/lib/personal-stats/types';

const TOP = 16;
const BOTTOM = 207;
const y = (value: number) => BOTTOM - value * (BOTTOM - TOP);

/** Each missing value starts a new segment, so missing history never appears as continuity. */
function linePath(values: (number | null)[], x: (index: number) => number) {
  let connected = false;
  return values
    .map((value, index) => {
      if (value === null) {
        connected = false;
        return '';
      }
      const command = connected ? 'L' : 'M';
      connected = true;
      return `${command}${x(index).toFixed(2)},${y(value).toFixed(2)}`;
    })
    .join(' ');
}

function ChartSvg({
  points,
  comparison,
  compact = false,
}: {
  points: PersonalStatsPoint[];
  comparison: boolean;
  compact?: boolean;
}) {
  const left = compact ? 45 : 54;
  const right = compact ? 344 : 744;
  const x = (index: number) =>
    points.length === 1
      ? (left + right) / 2
      : left + (index * (right - left)) / (points.length - 1);
  const personal = points.map((point) => point.totals.officeShare);
  const company = points.map((point) => point.companyShare);
  const visiblePoints = Math.min(points.length, compact ? 3 : 5);
  const labelIndices = new Set(
    Array.from({ length: visiblePoints }, (_, index) =>
      Math.round((index * (points.length - 1)) / Math.max(1, visiblePoints - 1))
    )
  );
  const id = compact ? 'personal-chart-mobile' : 'personal-chart-desktop';

  return (
    <svg
      className={compact ? 'personal-chart-mobile' : 'personal-chart-desktop'}
      viewBox={`0 0 ${compact ? 360 : 770} 250`}
      role="img"
      aria-labelledby={`${id}-title ${id}-description`}
    >
      <title id={`${id}-title`}>Office share over time</title>
      <desc id={`${id}-description`}>
        Your office share{comparison ? ' and the company average' : ''}, from 0 to 100 percent. Gaps
        indicate missing or withheld values. Exact values are in the table below.
      </desc>
      {[0, 0.25, 0.5, 0.75, 1].map((value) => (
        <g key={value}>
          <line x1={left} x2={right} y1={y(value)} y2={y(value)} className="personal-grid-line" />
          <text x={left - 9} y={y(value) + 4} textAnchor="end" className="personal-axis">
            {value * 100}%
          </text>
        </g>
      ))}
      {comparison && (
        <path
          data-series="company"
          d={linePath(company, x)}
          className="personal-line personal-line-company"
        />
      )}
      <path
        data-series="you"
        d={linePath(personal, x)}
        className="personal-line personal-line-you"
      />
      {points.map((point, index) => (
        <g key={point.key}>
          {comparison && point.companyShare !== null && (
            <circle
              cx={x(index)}
              cy={y(point.companyShare)}
              r="3"
              className="personal-dot personal-dot-company"
            >
              <title>
                {point.title}: company average {Math.round(point.companyShare * 100)}%
              </title>
            </circle>
          )}
          {point.totals.officeShare !== null && (
            <circle cx={x(index)} cy={y(point.totals.officeShare)} r="4" className="personal-dot">
              <title>
                {point.title}: your office share {Math.round(point.totals.officeShare * 100)}%
              </title>
            </circle>
          )}
          {labelIndices.has(index) && (
            <text
              x={x(index)}
              y="237"
              textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
              className="personal-axis"
            >
              {point.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export function AttendanceChart({
  points,
  comparison,
}: {
  points: PersonalStatsPoint[];
  comparison: boolean;
}) {
  const hasData = points.some(
    (point) => point.totals.officeShare !== null || (comparison && point.companyShare !== null)
  );
  if (!hasData)
    return (
      <div className="personal-chart-empty" role="status">
        <strong>No recorded working days yet</strong>
        <p>
          Office share will appear when office, remote or client days are recorded in this period.
        </p>
      </div>
    );
  return (
    <div className="personal-plot">
      <ChartSvg points={points} comparison={comparison} />
      <ChartSvg points={points} comparison={comparison} compact />
    </div>
  );
}
