import React from 'react';
import {
  ATTENDANCE_GROUPS,
  NO_STATUS_CODE,
  GROUP_KEYS,
  personDays,
  officeShare,
  weekdayOf,
} from '@/lib/employee-stats/stats';
import type { EmployeeDays } from '@/lib/employee-stats/stats';
import type { Bucket, DayCell, SeriesPoint, Spread } from '@/lib/employee-stats/history';
import { WEEKDAY_NAMES, percent, share } from '@/lib/employee-stats/format';
import { addDays, formatDay } from '@/lib/status/week';

// All charts are plain server-rendered SVG: nothing here ships to the browser, and each mark
// carries a <title> so hovering (or a screen reader) gives the exact figure.

const WIDTH = 760;
const HEIGHT = 250;
const MARGIN = { top: 10, right: 12, bottom: 30, left: 40 };
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;
const PERCENT_TICKS = [0, 0.25, 0.5, 0.75, 1];

const STACK_ORDER = [...GROUP_KEYS, 'none'] as const;
const GROUP_LABELS: Record<string, string> = {
  ...Object.fromEntries(ATTENDANCE_GROUPS.map(({ key, label }) => [key, label])),
  none: 'No status',
};

const yOf = (fraction: number) => MARGIN.top + PLOT_HEIGHT * (1 - fraction);
const fixed = (value: number) => Number(value.toFixed(2));

export function Legend({ includeNone = true }: { includeNone?: boolean }) {
  return (
    <ul className="stats-legend" aria-label="Legend">
      {STACK_ORDER.filter((key) => includeNone || key !== 'none').map((key) => (
        <li key={key}>
          <span className="stats-swatch" data-group={key} aria-hidden="true" />
          {GROUP_LABELS[key]}
        </li>
      ))}
    </ul>
  );
}

function PercentGrid() {
  return (
    <g className="stats-grid" aria-hidden="true">
      {PERCENT_TICKS.map((tick) => (
        <g key={tick}>
          <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={yOf(tick)} y2={yOf(tick)} />
          <text x={MARGIN.left - 8} y={yOf(tick) + 4} textAnchor="end">
            {Math.round(tick * 100)}%
          </text>
        </g>
      ))}
    </g>
  );
}

function BucketLabels({ buckets }: { buckets: readonly Bucket[] }) {
  const step = Math.max(1, Math.ceil(buckets.length / 12));
  const slot = PLOT_WIDTH / Math.max(buckets.length, 1);
  return (
    <g className="stats-axis" aria-hidden="true">
      {buckets.map(
        (bucket, index) =>
          index % step === 0 && (
            <text
              key={bucket.key}
              x={fixed(MARGIN.left + slot * (index + 0.5))}
              y={HEIGHT - 10}
              textAnchor="middle"
            >
              {bucket.label}
            </text>
          )
      )}
    </g>
  );
}

const describeDays = (days: EmployeeDays) => {
  const total = personDays(days);
  return STACK_ORDER.map((key) => {
    const count = key === 'none' ? days.noStatus : days.counts[key];
    return count > 0 ? `${GROUP_LABELS[key]} ${percent(share(count, total))}` : null;
  })
    .filter(Boolean)
    .join(', ');
};

/** How the days were spent in each period, as columns that each add up to 100%. */
export function AttendanceColumns({
  series,
  label,
}: {
  series: readonly SeriesPoint[];
  label: string;
}) {
  const slot = PLOT_WIDTH / Math.max(series.length, 1);
  const barWidth = Math.max(2, slot * 0.74);
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="stats-chart"
      role="img"
      aria-label={label}
      data-chart="attendance"
    >
      <PercentGrid />
      {series.map((point, index) => {
        const total = personDays(point);
        const x = fixed(MARGIN.left + slot * index + (slot - barWidth) / 2);
        let top = MARGIN.top + PLOT_HEIGHT;
        return (
          <g key={point.bucket.key} className="stats-column">
            <title>{`${point.bucket.title}: ${total === 0 ? 'no days' : describeDays(point)}`}</title>
            {total > 0 &&
              STACK_ORDER.map((key) => {
                const count = key === 'none' ? point.noStatus : point.counts[key];
                if (count === 0) return null;
                const height = (count / total) * PLOT_HEIGHT;
                top -= height;
                return (
                  <rect
                    key={key}
                    data-group={key}
                    x={x}
                    y={fixed(top)}
                    width={fixed(barWidth)}
                    height={fixed(height)}
                  />
                );
              })}
          </g>
        );
      })}
      <BucketLabels buckets={series.map((point) => point.bucket)} />
    </svg>
  );
}

export type TrendLine = {
  key: 'primary' | 'norm';
  label: string;
  values: readonly (number | null)[];
};

/** Lines of a share over time, optionally over a band of how widely colleagues vary. */
export function TrendChart({
  buckets,
  lines,
  spread,
  label,
}: {
  buckets: readonly Bucket[];
  lines: readonly TrendLine[];
  spread?: readonly (Spread | null)[];
  label: string;
}) {
  const slot = PLOT_WIDTH / Math.max(buckets.length, 1);
  const xOf = (index: number) => fixed(MARGIN.left + slot * (index + 0.5));

  // Gaps (no data in a period) break a line or band instead of being drawn as zero.
  const runs = <T,>(values: readonly (T | null)[]) => {
    const found: { index: number; value: T }[][] = [];
    let current: { index: number; value: T }[] = [];
    values.forEach((value, index) => {
      if (value === null) {
        if (current.length) found.push(current);
        current = [];
      } else current.push({ index, value });
    });
    if (current.length) found.push(current);
    return found;
  };

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="stats-chart"
      role="img"
      aria-label={label}
      data-chart="trend"
    >
      <PercentGrid />
      {spread &&
        runs(spread).map((run) => (
          <polygon
            key={run[0]!.index}
            className="stats-band"
            points={[
              ...run.map(({ index, value }) => `${xOf(index)},${fixed(yOf(value.high))}`),
              ...[...run]
                .reverse()
                .map(({ index, value }) => `${xOf(index)},${fixed(yOf(value.low))}`),
            ].join(' ')}
          >
            <title>Where the middle half of colleagues were</title>
          </polygon>
        ))}
      {lines.map((line) => (
        <g key={line.key} className="stats-line" data-line={line.key}>
          {runs(line.values).map((run) =>
            run.length > 1 ? (
              <polyline
                key={run[0]!.index}
                points={run
                  .map(({ index, value }) => `${xOf(index)},${fixed(yOf(value))}`)
                  .join(' ')}
              />
            ) : null
          )}
          {buckets.length <= 60 &&
            line.values.map((value, index) =>
              value === null ? null : (
                <circle key={buckets[index]!.key} cx={xOf(index)} cy={fixed(yOf(value))} r={3}>
                  <title>{`${buckets[index]!.title}: ${line.label} ${percent(value)}`}</title>
                </circle>
              )
            )}
        </g>
      ))}
      <BucketLabels buckets={buckets} />
    </svg>
  );
}

export function TrendLegend({
  primary,
  norm,
  band,
}: {
  primary: string;
  norm?: string;
  band?: boolean;
}) {
  return (
    <ul className="stats-legend" aria-label="Legend">
      <li>
        <span className="stats-key-line" data-line="primary" aria-hidden="true" />
        {primary}
      </li>
      {norm && (
        <li>
          <span className="stats-key-line" data-line="norm" aria-hidden="true" />
          {norm}
        </li>
      )}
      {band && (
        <li>
          <span className="stats-key-band" aria-hidden="true" />
          Middle half of colleagues
        </li>
      )}
    </ul>
  );
}

export type WeekdayBar = { label: string; value: number | null; norm?: number | null };

/** Office share per weekday as bars, with the norm as a tick across each bar. */
export function WeekdayBars({ items, label }: { items: readonly WeekdayBar[]; label: string }) {
  const height = 210;
  const plotHeight = height - MARGIN.top - 34;
  const y = (fraction: number) => MARGIN.top + plotHeight * (1 - fraction);
  const slot = (360 - MARGIN.left - 8) / items.length;
  const barWidth = slot * 0.56;
  return (
    <svg
      viewBox={`0 0 360 ${height}`}
      className="stats-chart"
      role="img"
      aria-label={label}
      data-chart="weekday"
    >
      <g className="stats-grid" aria-hidden="true">
        {PERCENT_TICKS.map((tick) => (
          <g key={tick}>
            <line x1={MARGIN.left} x2={352} y1={y(tick)} y2={y(tick)} />
            <text x={MARGIN.left - 8} y={y(tick) + 4} textAnchor="end">
              {Math.round(tick * 100)}%
            </text>
          </g>
        ))}
      </g>
      {items.map((item, index) => {
        const x = MARGIN.left + slot * index + (slot - barWidth) / 2;
        return (
          <g key={item.label}>
            <title>
              {`${item.label}: ${percent(item.value)} in the office${
                item.norm !== undefined ? `, norm ${percent(item.norm)}` : ''
              }`}
            </title>
            {item.value !== null && (
              <rect
                data-group="office"
                x={fixed(x)}
                y={fixed(y(item.value))}
                width={fixed(barWidth)}
                height={fixed(plotHeight * item.value)}
              />
            )}
            {item.norm != null && (
              <line
                className="stats-norm-tick"
                x1={fixed(x - 5)}
                x2={fixed(x + barWidth + 5)}
                y1={fixed(y(item.norm))}
                y2={fixed(y(item.norm))}
              />
            )}
            <text
              className="stats-axis-text"
              x={fixed(x + barWidth / 2)}
              y={height - 12}
              textAnchor="middle"
            >
              {item.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const CELL = 13;
const PITCH = 16;

/** One square per workday, a column per week: shows streaks and patterns at a glance. */
export function DayCalendar({ cells, label }: { cells: readonly DayCell[]; label: string }) {
  const first = cells[0];
  if (!first) return null;
  const firstMonday = addDays(first.date, 1 - weekdayOf(first.date));
  const column = (date: string) =>
    Math.round(
      (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${firstMonday}T00:00:00Z`)) / (7 * 864e5)
    );
  const columns = column(cells.at(-1)!.date) + 1;
  const left = 26;
  const top = 20;

  const months: { column: number; text: string }[] = [];
  for (const { date } of cells) {
    const text = formatDay(date, { month: 'short' });
    const index = column(date);
    const previous = months.at(-1);
    if (!previous || (previous.text !== text && index - previous.column >= 3)) {
      months.push({ column: index, text });
    }
  }

  return (
    <svg
      viewBox={`0 0 ${left + columns * PITCH} ${top + 5 * PITCH}`}
      className="stats-chart stats-calendar"
      role="img"
      aria-label={label}
      data-chart="calendar"
      style={{
        minWidth: `${Math.min(columns * PITCH + left, 900)}px`,
        // A short history keeps small squares instead of stretching to the card.
        maxWidth: `${Math.round((columns * PITCH + left) * 1.5)}px`,
      }}
    >
      <g className="stats-axis" aria-hidden="true">
        {months.map(({ column: index, text }) => (
          <text key={`${index}-${text}`} x={left + index * PITCH} y={12}>
            {text}
          </text>
        ))}
        {['M', 'T', 'W', 'T', 'F'].map((name, row) => (
          <text key={row} x={0} y={top + row * PITCH + CELL - 2}>
            {name}
          </text>
        ))}
      </g>
      {cells.map(({ date, code }) =>
        code < 0 ? null : (
          <rect
            key={date}
            data-group={code === NO_STATUS_CODE ? 'none' : GROUP_KEYS[code]}
            x={left + column(date) * PITCH}
            y={top + (weekdayOf(date) - 1) * PITCH}
            width={CELL}
            height={CELL}
            rx={2}
          >
            <title>
              {`${formatDay(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}: ${
                GROUP_LABELS[code === NO_STATUS_CODE ? 'none' : GROUP_KEYS[code]!]
              }`}
            </title>
          </rect>
        )
      )}
    </svg>
  );
}

/** A thin bar showing how a person's days split, for use in a table row. */
export function SegmentBar({ days }: { days: EmployeeDays }) {
  const total = personDays(days);
  return (
    <span
      className="stats-segments"
      role="img"
      aria-label={total === 0 ? 'No days' : describeDays(days)}
      title={total === 0 ? 'No days' : describeDays(days)}
    >
      {total > 0 &&
        STACK_ORDER.map((key) => {
          const count = key === 'none' ? days.noStatus : days.counts[key];
          return count === 0 ? null : (
            <span key={key} data-group={key} style={{ width: `${(count / total) * 100}%` }} />
          );
        })}
    </span>
  );
}

/** Each group's share of a person's days, with the norm's share marked on the same bar. */
export function GroupComparison({
  person,
  norm,
}: {
  person: EmployeeDays;
  norm: EmployeeDays | null;
}) {
  const personTotal = personDays(person);
  const normTotal = norm ? personDays(norm) : 0;
  const hasNone = person.noStatus > 0 || (norm?.noStatus ?? 0) > 0;
  return (
    <ul className="stats-breakdown">
      {STACK_ORDER.filter((key) => key !== 'none' || hasNone).map((key) => {
        const mine = share(key === 'none' ? person.noStatus : person.counts[key], personTotal);
        const typical = norm
          ? share(key === 'none' ? norm.noStatus : norm.counts[key], normTotal)
          : null;
        return (
          <li key={key}>
            <div>
              <span>{GROUP_LABELS[key]}</span>
              <strong>{percent(mine)}</strong>
              {norm && <small>norm {percent(typical)}</small>}
            </div>
            <span className="stats-bar" aria-hidden="true">
              <span data-group={key} style={{ width: `${(mine ?? 0) * 100}%` }} />
              {typical !== null && (
                <i className="stats-bar-norm" style={{ left: `${typical * 100}%` }} />
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export const weekdayBars = (
  weekdays: readonly { counts: EmployeeDays['counts'] }[],
  norm?: readonly { counts: EmployeeDays['counts'] }[] | null
): WeekdayBar[] =>
  weekdays.map((day, index) => ({
    label: WEEKDAY_NAMES[index]!.slice(0, 3),
    value: officeShare(day.counts),
    ...(norm ? { norm: officeShare(norm[index]!.counts) } : {}),
  }));
