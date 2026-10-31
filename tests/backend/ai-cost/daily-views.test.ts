import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  cumulativeUsage,
  DailyCostPanel,
  DailyCostView,
} from '@/app/(authenticated)/ai-cost/DailyCostPanel';
import { emptyAiUsage, type DailyAiUsage } from '@/lib/ai-cost/stats';

const daily: DailyAiUsage[] = [
  { date: '2026-10-27', ...emptyAiUsage() },
  { date: '2026-10-28', ...emptyAiUsage(), calls: 1, unpricedCalls: 1 },
  { date: '2026-10-29', ...emptyAiUsage(), calls: 2, costUsd: 0.003, inputTokens: 100 },
  { date: '2026-10-30', ...emptyAiUsage(), calls: 1, costUsd: 0, failedCalls: 1 },
  { date: '2026-10-31', ...emptyAiUsage(), calls: 2, costUsd: 0.002, unpricedCalls: 1 },
];
const render = (view: 'bars' | 'line' | 'cumulative' | 'table', data = daily) =>
  renderToStaticMarkup(React.createElement(DailyCostView, { daily: data, view }));

describe('daily cost views', () => {
  it('defaults to bars and exposes the four view controls as pressed buttons', () => {
    const html = renderToStaticMarkup(React.createElement(DailyCostPanel, { daily }));
    expect(html).toMatch(/aria-pressed="true"[^>]*>Bars/);
    for (const label of ['Line', 'Cumulative', 'Table']) {
      expect(html).toMatch(new RegExp(`aria-pressed="false"[^>]*>${label}`));
    }
    expect(html).toContain('aria-label="Cost data view"');
    expect(html).toContain('aria-label="Daily reported cost"');
  });

  it('distinguishes unknown, partial, zero cost and no calls in the daily table', () => {
    const html = render('table');
    expect(html).toContain('27 Oct');
    expect(html).toContain('28 Oct');
    expect(html).toContain('Unknown');
    expect(html).toContain('$0.0020 + unknown');
    expect(html.match(/\$0.0000/g)).toHaveLength(2);
    expect(html).toContain('<td>100</td>');
    expect(html).toContain('Without cost');
  });

  it('retains unknown costs as gaps in the daily line', () => {
    const html = render('line');
    // Day 1 has no calls, day 2 is unknown, days 3-5 have reported costs.
    expect(html).toMatch(/d="M0,180\s+M480,0 L720,180 L960,60[^"]*"/);
    expect(html).toContain('28 Oct, Unknown, 1 call, 1 without reported cost');
    expect(html.match(/data-unpriced="true"/g)).toHaveLength(2);
  });

  it('adds only reported costs and carries incomplete status through later days', () => {
    const totals = cumulativeUsage(daily);
    expect(totals.map((day) => day.costUsd)).toEqual([null, null, 0.003, 0.003, 0.005]);
    expect(totals.map((day) => day.unpricedCalls)).toEqual([0, 1, 1, 1, 2]);
    const html = render('cumulative');
    expect(html).toContain('30 Oct, cumulative reported cost $0.0030 + unknown');
    expect(html).toContain('31 Oct, cumulative reported cost $0.0050 + unknown');
  });

  it('keeps all-unknown costs unknown without invalid chart coordinates', () => {
    for (const view of ['bars', 'line', 'cumulative', 'table'] as const) {
      const html = render(view, [daily[1]]);
      expect(html).toContain('Unknown');
      expect(html).not.toMatch(/NaN|Infinity/);
    }
  });

  it.each(['bars', 'line', 'cumulative', 'table'] as const)(
    'shows the empty state in %s view',
    (view) => expect(render(view, [daily[0]])).toContain('No AI calls were recorded')
  );
});
