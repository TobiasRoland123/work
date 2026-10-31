import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MessageTrend } from '@/app/(authenticated)/ai-cost/MessageTrend';
import {
  MessagesHandledPanel,
  MessagesHandledView,
} from '@/app/(authenticated)/ai-cost/MessagesHandledPanel';
import { periodDays, type DailyMessageCounts } from '@/lib/ai-cost/stats';

const dailyMessages: DailyMessageCounts[] = [
  { date: '2026-10-27', ai: 0, withoutAi: 2, total: 2 },
  { date: '2026-10-28', ai: 2, withoutAi: 0, total: 2 },
  { date: '2026-10-29', ai: 0, withoutAi: 0, total: 0 },
  { date: '2026-10-30', ai: 1, withoutAi: 1, total: 2 },
  { date: '2026-10-31', ai: 3, withoutAi: 1, total: 4 },
];
const messages = { ai: 6, withoutAi: 4, total: 10 };
const render = (data = dailyMessages) =>
  renderToStaticMarkup(React.createElement(MessageTrend, { dailyMessages: data }));

describe('daily message handling trend', () => {
  it('defaults to the trend while retaining period totals', () => {
    const html = renderToStaticMarkup(
      React.createElement(MessagesHandledPanel, { dailyMessages, messages })
    );
    expect(html).toMatch(/aria-pressed="true"[^>]*>Trend/);
    expect(html).toContain('AI share by day');
    expect(html).toContain('Messages per day');
    expect(html).toContain('<strong>6</strong><small>60%</small>');
    expect(html).toContain('<strong>4</strong><small>40%</small>');
  });

  it('uses a fixed percentage scale and leaves a gap on inactive days', () => {
    const html = render();
    expect(html).toContain('<span>100%</span><span>50%</span><span>0%</span>');
    expect(html).toContain('d="M96,100 L288,0  M672,50 L864,25"');
    expect(html.match(/<circle /g)).toHaveLength(4);
    expect(html).toContain('29 Oct, 0 with AI, 0 without AI, 0 total, no AI share');
    expect(html).toContain('Days without messages have no AI share and leave gaps in the line.');
  });

  it('shows daily counts and AI percentages in accessible descriptions', () => {
    const html = render();
    expect(html).toContain('31 Oct, 3 with AI, 1 without AI, 4 total, 75% with AI');
    expect(html).toContain('27 Oct, 0 with AI, 2 without AI, 2 total, 0% with AI');
    expect(html).toContain('28 Oct, 2 with AI, 0 without AI, 2 total, 100% with AI');
    expect(html).toContain('aria-label="Daily message handling in Copenhagen time"');
  });

  it('stacks daily counts against the volume scale and aligns them with share points', () => {
    const html = render();
    expect(html).toContain('Scale: 0–4');
    expect(html).toContain('cx="864" cy="25"');
    expect(html).toContain(
      'x="848" y="20" width="32" height="60" class="ai-cost-message-volume-ai"'
    );
    expect(html).toContain(
      'x="848" y="0" width="32" height="20" class="ai-cost-message-volume-without"'
    );
  });

  it('renders an isolated day as a visible point without connecting over empty days', () => {
    const html = render([
      { ...dailyMessages[2], date: '2026-10-29' },
      { ...dailyMessages[4], date: '2026-10-30' },
      { ...dailyMessages[2], date: '2026-10-31' },
    ]);
    expect(html.match(/<circle /g)).toHaveLength(1);
    expect(html).toContain('d=" M480,25 "');
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it.each([7, 30, 90])('renders all %s days with readable date label spacing', (days) => {
    const data = periodDays(days, new Date('2026-10-31T12:00:00Z')).map((date) => ({
      date,
      ai: 0,
      withoutAi: 1,
      total: 1,
    }));
    const html = render(data);
    expect(html.match(/<li>/g)).toHaveLength(days);
    expect(html.match(/<circle /g)).toHaveLength(days);
    expect(html).toContain('31 Oct');
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it('adds daily detail to table view and does not invent a share on empty days', () => {
    const html = renderToStaticMarkup(
      React.createElement(MessagesHandledView, { dailyMessages, messages, view: 'table' })
    );
    expect(html.match(/<table /g)).toHaveLength(2);
    expect(html).toContain('<th scope="row">Total</th><td>10</td><td>100%</td>');
    expect(html).toContain('Daily handled messages · Copenhagen time');
    expect(html).toContain('29 Oct</th><td>0</td><td>0</td><td>0</td><td>No messages</td>');
    expect(html).toContain('31 Oct</th><td>3</td><td>1</td><td>4</td><td>75%</td>');
  });

  it('renders an all-empty period without claiming a trend', () => {
    const html = renderToStaticMarkup(
      React.createElement(MessagesHandledView, {
        messages: { ai: 0, withoutAi: 0, total: 0 },
        dailyMessages: [dailyMessages[2]],
        view: 'trend',
      })
    );
    expect(html).toContain('No handled messages were recorded in this period.');
    expect(html).not.toContain('<svg');
  });

  it('does not substitute period totals for missing daily data', () => {
    expect(render([])).toContain('Daily message history is unavailable for this period.');
  });
});
