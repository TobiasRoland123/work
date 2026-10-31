'use client';

import React, { useId, useState } from 'react';
import type { DailyAiUsage } from '@/lib/ai-cost/stats';
import { addAiUsage, emptyAiUsage } from '@/lib/ai-cost/stats';
import { calls, costLabel, count, dayLabel, usd } from '@/lib/ai-cost/format';

const views = [
  ['bars', 'Bars'],
  ['line', 'Line'],
  ['cumulative', 'Cumulative'],
  ['table', 'Table'],
] as const;
type View = (typeof views)[number][0];

function dayDescription(day: DailyAiUsage) {
  const parts = [dayLabel(day.date, true), costLabel(day), calls(day.calls)];
  if (day.unpricedCalls > 0) parts.push(`${day.unpricedCalls} without reported cost`);
  if (day.failedCalls > 0) parts.push(`${day.failedCalls} failed`);
  return parts.join(', ');
}

export function cumulativeUsage(daily: DailyAiUsage[]): DailyAiUsage[] {
  let total = emptyAiUsage();
  return daily.map((day) => {
    total = addAiUsage(total, day);
    return { date: day.date, ...total };
  });
}

function showDate(index: number, length: number) {
  const step = length <= 7 ? 1 : length <= 30 ? 7 : 15;
  return (length - 1 - index) % step === 0;
}

function DailyBars({ daily }: { daily: DailyAiUsage[] }) {
  const max = Math.max(0, ...daily.map((day) => day.costUsd ?? 0));
  return (
    <ol className="ai-cost-chart" data-days={daily.length} aria-label="Daily reported cost">
      {daily.map((day, index) => (
        <li key={day.date} title={dayDescription(day)}>
          <span className="sr-only">{dayDescription(day)}</span>
          <span className="ai-cost-bar-area" aria-hidden="true">
            <span
              className="ai-cost-bar"
              data-empty={day.calls === 0 || undefined}
              data-unpriced={day.unpricedCalls > 0 || undefined}
              style={{ height: `${max > 0 ? ((day.costUsd ?? 0) / max) * 100 : 0}%` }}
            />
          </span>
          <span className="ai-cost-axis" aria-hidden="true">
            {showDate(index, daily.length) ? dayLabel(day.date, daily.length <= 7) : ''}
          </span>
        </li>
      ))}
    </ol>
  );
}

function CostLine({ daily, cumulative }: { daily: DailyAiUsage[]; cumulative: boolean }) {
  const data = cumulative ? cumulativeUsage(daily) : daily;
  const max = Math.max(0, ...data.map((day) => day.costUsd ?? 0));
  const width = 960;
  const height = 180;
  const points = data.map((day, index) => ({
    day,
    // Unknown costs leave gaps. Days without requests have a known zero cost.
    known: day.costUsd !== null || day.calls === 0,
    x: data.length > 1 ? (index / (data.length - 1)) * width : width / 2,
    y: max > 0 ? height - ((day.costUsd ?? 0) / max) * height : height,
  }));
  const path = points
    .map((point, index) =>
      point.known ? `${index > 0 && points[index - 1].known ? 'L' : 'M'}${point.x},${point.y}` : ''
    )
    .join(' ');
  const description = (day: DailyAiUsage) =>
    cumulative
      ? `${dayLabel(day.date, true)}, cumulative reported cost ${costLabel(day)}`
      : dayDescription(day);

  return (
    <>
      <div className="ai-cost-line-scale" aria-hidden="true">
        <span>{usd(max)}</span>
        <span>$0.0000</span>
      </div>
      <div className="ai-cost-line-chart">
        <svg
          viewBox={`-6 -6 ${width + 12} ${height + 12}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <line x1="0" y1={height} x2={width} y2={height} className="ai-cost-line-baseline" />
          <path d={path} className="ai-cost-line-path" />
          {points.map(({ day, x, y, known }) => (
            <circle
              key={day.date}
              cx={x}
              cy={known ? y : height}
              r={day.unpricedCalls > 0 ? 4 : 2.5}
              className="ai-cost-line-point"
              data-unpriced={day.unpricedCalls > 0 || undefined}
            >
              <title>{description(day)}</title>
            </circle>
          ))}
        </svg>
        <ol
          className="ai-cost-line-dates"
          aria-label={cumulative ? 'Cumulative reported cost' : 'Daily reported cost'}
        >
          {data.map((day, index) => (
            <li key={day.date}>
              <span className="sr-only">{description(day)}</span>
              <span aria-hidden="true">
                {showDate(index, data.length) ? dayLabel(day.date) : ''}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}

export function DailyCostView({ daily, view }: { daily: DailyAiUsage[]; view: View }) {
  if (daily.every((day) => day.calls === 0)) {
    return <p className="ai-cost-empty">No AI calls were recorded in this period.</p>;
  }
  if (view === 'table') {
    return (
      <div className="ai-cost-table-scroll ai-cost-daily-table">
        <table className="ai-cost-table">
          <caption className="sr-only">
            Daily AI usage and reported costs in Copenhagen time
          </caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Calls</th>
              <th scope="col">Failed</th>
              <th scope="col">Tokens in</th>
              <th scope="col">Tokens out</th>
              <th scope="col">Without cost</th>
              <th scope="col">Cost (USD)</th>
            </tr>
          </thead>
          <tbody>
            {daily.map((day) => (
              <tr key={day.date}>
                <th scope="row">{dayLabel(day.date, true)}</th>
                <td>{count.format(day.calls)}</td>
                <td>{count.format(day.failedCalls)}</td>
                <td>{count.format(day.inputTokens)}</td>
                <td>{count.format(day.outputTokens)}</td>
                <td>{count.format(day.unpricedCalls)}</td>
                <td>{costLabel(day)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return view === 'bars' ? (
    <DailyBars daily={daily} />
  ) : (
    <CostLine daily={daily} cumulative={view === 'cumulative'} />
  );
}

export function DailyCostPanel({ daily }: { daily: DailyAiUsage[] }) {
  const [view, setView] = useState<View>('bars');
  const panelId = useId();
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="ai-cost-section ai-cost-panel">
      <div className="ai-cost-panel-heading">
        <h2 id={headingId}>{view === 'cumulative' ? 'Cumulative reported cost' : 'Daily cost'}</h2>
        <div className="ai-cost-views" role="group" aria-label="Cost data view">
          {views.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              aria-controls={panelId}
              onClick={() => setView(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {view !== 'table' && (
        <p className="ai-cost-legend ai-cost-chart-legend">
          <span className="ai-cost-legend-unpriced" />
          {view === 'bars' ? 'Hatched bars' : 'Hollow points'} include calls without reported cost.
          Missing costs are not estimated.
        </p>
      )}
      {view === 'cumulative' && (
        <p className="ai-cost-note ai-cost-cumulative-note">
          Running total from the start of the selected period. Totals remain incomplete after a call
          without reported cost.
        </p>
      )}
      <div id={panelId}>
        <DailyCostView daily={daily} view={view} />
      </div>
    </section>
  );
}
