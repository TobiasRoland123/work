import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  MessagesHandledPanel,
  MessagesHandledView,
} from '@/app/(authenticated)/ai-cost/MessagesHandledPanel';

const messages = { ai: 3, withoutAi: 2, total: 5 };
const views = ['trend', 'summary', 'bars', 'donut', 'table'] as const;
const render = (view: (typeof views)[number], data = messages) =>
  renderToStaticMarkup(React.createElement(MessagesHandledView, { messages: data, view }));

describe('messages handled views', () => {
  it('defaults to the trend and labels all five controls', () => {
    const html = renderToStaticMarkup(React.createElement(MessagesHandledPanel, { messages }));
    expect(html).toMatch(/aria-pressed="true"[^>]*>Trend/);
    for (const label of ['Summary', 'Bars', 'Donut', 'Table']) {
      expect(html).toMatch(new RegExp(`aria-pressed="false"[^>]*>${label}`));
    }
    expect(html).toContain('aria-label="Messages handled view"');
    expect(html).toContain('5 recorded messages');
    expect(html).toContain('Daily message history is unavailable for this period.');
    expect(html).toContain('<strong>3</strong><small>60%</small>');
    expect(html).toContain('<strong>2</strong><small>40%</small>');
    expect(html).toContain('Tracking starts with this feature');
  });

  it('renders category bars against the same total', () => {
    const html = render('bars');
    expect(html).toContain('ai-cost-message-track');
    expect(html).toContain('width:60%');
    expect(html).toContain('width:40%');
    expect(html).toContain('<strong>3</strong><small>60%</small>');
    expect(html).toContain('<strong>2</strong><small>40%</small>');
  });

  it('renders a donut with visible total and accessible category counts', () => {
    const html = render('donut');
    expect(html).toContain('conic-gradient(var(--ai-cost-link) 60%, var(--ai-cost-raised) 0)');
    expect(html).toContain('<strong>5</strong><small>Messages</small>');
    expect(html).toContain('<strong>3</strong><small>60%</small>');
    expect(html).toContain('<strong>2</strong><small>40%</small>');
  });

  it('renders category counts and percentages with the total in table view', () => {
    const html = render('table');
    expect(html).toContain('<th scope="row">With AI</th><td>3</td><td>60%</td>');
    expect(html).toContain('<th scope="row">Without AI</th><td>2</td><td>40%</td>');
    expect(html).toContain('<th scope="row">Total</th><td>5</td><td>100%</td>');
  });

  it.each(views)('shows an empty state in %s without a chart or percentage', (view) => {
    const html = render(view, { ai: 0, withoutAi: 0, total: 0 });
    expect(html).toContain('No handled messages were recorded in this period.');
    expect(html).not.toContain('%');
    expect(html).not.toMatch(/NaN|Infinity|conic-gradient|ai-cost-message-bar|<table/);
  });

  it.each(views)('handles all-AI and all-without-AI in %s', (view) => {
    for (const data of [
      { ai: 0, withoutAi: 8, total: 8 },
      { ai: 8, withoutAi: 0, total: 8 },
    ]) {
      const html = render(view, data);
      expect(html).toContain('0%');
      expect(html).toContain('100%');
      expect(html).not.toMatch(/NaN|Infinity/);
    }
  });

  it('rounds percentages consistently and formats large counts', () => {
    const html = render('table', { ai: 1000, withoutAi: 2000, total: 3000 });
    expect(html).toContain('<td>1,000</td><td>33.3%</td>');
    expect(html).toContain('<td>2,000</td><td>66.7%</td>');
    expect(html).toContain('<td>3,000</td><td>100%</td>');
  });
});
