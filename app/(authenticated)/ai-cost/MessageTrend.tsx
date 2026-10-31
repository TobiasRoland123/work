import React from 'react';
import type { DailyMessageCounts } from '@/lib/ai-cost/stats';
import { count, dayLabel } from '@/lib/ai-cost/format';

const percent = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });

function description(day: DailyMessageCounts) {
  const share =
    day.total > 0 ? `${percent.format((day.ai / day.total) * 100)}% with AI` : 'no AI share';
  return `${dayLabel(day.date, true)}, ${count.format(day.ai)} with AI, ${count.format(day.withoutAi)} without AI, ${count.format(day.total)} total, ${share}`;
}

export function MessageTrend({ dailyMessages }: { dailyMessages: DailyMessageCounts[] }) {
  if (dailyMessages.length === 0) {
    return <p className="ai-cost-empty">Daily message history is unavailable for this period.</p>;
  }
  const width = 960;
  const points = dailyMessages.map((day, index) => ({
    day,
    x: ((index + 0.5) / dailyMessages.length) * width,
    y: day.total > 0 ? 100 - (day.ai / day.total) * 100 : null,
  }));
  const path = points
    .map((point, index) =>
      point.y === null
        ? ''
        : `${index > 0 && points[index - 1].y !== null ? 'L' : 'M'}${point.x},${point.y}`
    )
    .join(' ');
  const maxVolume = Math.max(1, ...dailyMessages.map((day) => day.total));
  const barWidth = Math.min(32, (width / dailyMessages.length) * 0.7);
  const dateStep = dailyMessages.length <= 7 ? 1 : dailyMessages.length <= 30 ? 7 : 15;
  return (
    <div className="ai-cost-message-trend">
      <h3>AI share by day</h3>
      <div className="ai-cost-share-plot">
        <div className="ai-cost-share-scale" aria-hidden="true">
          <span>100%</span>
          <span>50%</span>
          <span>0%</span>
        </div>
        <svg
          viewBox={`0 -5 ${width} 110`}
          preserveAspectRatio="none"
          aria-hidden="true"
          className="ai-cost-share-svg"
        >
          {[0, 50, 100].map((y) => (
            <line key={y} x1="0" y1={y} x2={width} y2={y} className="ai-cost-line-baseline" />
          ))}
          <path d={path} className="ai-cost-line-path" />
          {points.map(
            ({ day, x, y }) =>
              y !== null && (
                <circle key={day.date} cx={x} cy={y} r="3.5" className="ai-cost-line-point">
                  <title>{description(day)}</title>
                </circle>
              )
          )}
        </svg>
      </div>
      <div className="ai-cost-message-volume-heading">
        <h3>Messages per day</h3>
        <span className="ai-cost-legend">Scale: 0–{count.format(maxVolume)}</span>
      </div>
      <div className="ai-cost-message-volume-plot">
        <svg viewBox={`0 0 ${width} 80`} preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" y1="80" x2={width} y2="80" className="ai-cost-line-baseline" />
          {points.map(({ day, x }) => {
            const aiHeight = (day.ai / maxVolume) * 80;
            const withoutHeight = (day.withoutAi / maxVolume) * 80;
            return (
              <g key={day.date}>
                <title>{description(day)}</title>
                <rect
                  x={x - barWidth / 2}
                  y={80 - aiHeight}
                  width={barWidth}
                  height={aiHeight}
                  className="ai-cost-message-volume-ai"
                />
                <rect
                  x={x - barWidth / 2}
                  y={80 - aiHeight - withoutHeight}
                  width={barWidth}
                  height={withoutHeight}
                  className="ai-cost-message-volume-without"
                />
              </g>
            );
          })}
        </svg>
      </div>
      <ol
        className="ai-cost-message-trend-dates"
        aria-label="Daily message handling in Copenhagen time"
      >
        {dailyMessages.map((day, index) => (
          <li key={day.date}>
            <span className="sr-only">{description(day)}</span>
            <span aria-hidden="true">
              {(dailyMessages.length - 1 - index) % dateStep === 0 ? dayLabel(day.date) : ''}
            </span>
          </li>
        ))}
      </ol>
      <div className="ai-cost-message-trend-legend" aria-hidden="true">
        <span>
          <i className="ai-cost-message-key" />
          With AI
        </span>
        <span>
          <i className="ai-cost-message-key" data-without-ai />
          Without AI
        </span>
      </div>
      <p className="ai-cost-note">
        AI share is the percentage of handled messages that used AI each day. Days without messages
        have no AI share and leave gaps in the line.
      </p>
    </div>
  );
}

export function DailyMessagesTable({ dailyMessages }: { dailyMessages: DailyMessageCounts[] }) {
  return (
    <div className="ai-cost-table-scroll ai-cost-daily-table">
      <table className="ai-cost-table">
        <caption>Daily handled messages · Copenhagen time</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">With AI</th>
            <th scope="col">Without AI</th>
            <th scope="col">Total</th>
            <th scope="col">AI share</th>
          </tr>
        </thead>
        <tbody>
          {dailyMessages.map((day) => (
            <tr key={day.date}>
              <th scope="row">{dayLabel(day.date, true)}</th>
              <td>{count.format(day.ai)}</td>
              <td>{count.format(day.withoutAi)}</td>
              <td>{count.format(day.total)}</td>
              <td>
                {day.total > 0 ? `${percent.format((day.ai / day.total) * 100)}%` : 'No messages'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
