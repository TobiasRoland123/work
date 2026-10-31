import React from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { requirePageUserId } from '@/lib/auth/require-user';
import { requireMessageReviewer } from '@/lib/auth/message-review';
import { getAiCostDashboard } from '@/lib/ai-cost/service';
import type { AiUsageTotals, DailyAiUsage } from '@/lib/ai-cost/service';
import { AI_COST_PERIODS, averageCostPerPricedCall } from '@/lib/ai-cost/stats';
import './ai-cost.css';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ days?: string | string[] }>;

const one = (value: string | string[] | undefined) =>
  typeof value === 'string' ? value : undefined;

const count = new Intl.NumberFormat('en-GB');

function usd(value: number | null) {
  if (value === null) return 'N/A';
  if (value > 0 && value < 0.0001) return '<$0.0001';
  return `$${value.toFixed(4)}`;
}

function costLabel({ costUsd, calls, unpricedCalls }: AiUsageTotals) {
  if (calls === 0) return '$0.0000';
  if (costUsd === null) return 'Unknown';
  return `${usd(costUsd)}${unpricedCalls > 0 ? ' + unknown' : ''}`;
}

function calls(value: number) {
  return `${count.format(value)} ${value === 1 ? 'call' : 'calls'}`;
}

function dayLabel(value: string, weekday = false) {
  return new Intl.DateTimeFormat('en-GB', {
    ...(weekday ? { weekday: 'short' as const } : {}),
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}

function monthLabel(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}

function dayDescription(day: DailyAiUsage) {
  const parts = [dayLabel(day.date, true), costLabel(day), calls(day.calls)];
  if (day.unpricedCalls > 0) parts.push(`${day.unpricedCalls} without reported cost`);
  if (day.failedCalls > 0) parts.push(`${day.failedCalls} failed`);
  return parts.join(', ');
}

function DailyChart({ daily }: { daily: DailyAiUsage[] }) {
  const max = Math.max(0, ...daily.map((day) => day.costUsd ?? 0));
  // Label today and every step before it so the axis stays readable at 90 days.
  const step = daily.length <= 7 ? 1 : daily.length <= 30 ? 7 : 15;
  return (
    <ol className="ai-cost-chart" data-days={daily.length}>
      {daily.map((day, index) => {
        const height = max > 0 ? ((day.costUsd ?? 0) / max) * 100 : 0;
        const label = (daily.length - 1 - index) % step === 0;
        return (
          <li key={day.date} title={dayDescription(day)}>
            <span className="sr-only">{dayDescription(day)}</span>
            <span className="ai-cost-bar-area" aria-hidden="true">
              <span
                className="ai-cost-bar"
                data-empty={day.calls === 0 || undefined}
                data-unpriced={day.unpricedCalls > 0 || undefined}
                style={{ height: `${height}%` }}
              />
            </span>
            <span className="ai-cost-axis" aria-hidden="true">
              {label ? dayLabel(day.date, daily.length <= 7) : ''}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default async function AiCostPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePageUserId();
  await requireMessageReviewer();
  const params = await searchParams;
  const data = await getAiCostDashboard({ days: one(params.days) });
  const { totals, messages } = data;
  const aiShare = messages.total > 0 ? (messages.ai / messages.total) * 100 : 0;
  const percent = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });
  const average = averageCostPerPricedCall(totals);

  return (
    <main id="dashboard-main" className="content-page ai-cost-page">
      <PageHeader title="AI cost" subtitle="Reported AI charges for interpreting Slack messages" />
      <div className="content-page-body ai-cost-body">
        <section aria-labelledby="ai-cost-period-heading" className="ai-cost-section">
          <div className="ai-cost-heading-row">
            <div>
              <h2 id="ai-cost-period-heading">Last {data.days} days</h2>
              <p>
                {dayLabel(data.startDate)}–{dayLabel(data.endDate)} · Copenhagen time
              </p>
            </div>
            <nav aria-label="Period" className="ai-cost-periods">
              {AI_COST_PERIODS.map((days) => (
                <Link
                  key={days}
                  href={`/ai-cost?days=${days}`}
                  aria-current={days === data.days ? 'page' : undefined}
                >
                  {days} days
                </Link>
              ))}
            </nav>
          </div>

          <div className="ai-cost-summary" aria-label="Period totals">
            <div>
              <span>Reported cost</span>
              <strong>{totals.calls === 0 ? usd(0) : usd(totals.costUsd)}</strong>
              <small>{totals.unpricedCalls > 0 ? 'USD · incomplete' : 'USD'}</small>
            </div>
            <div>
              <span>AI calls</span>
              <strong>{count.format(totals.calls)}</strong>
              <small>Including retries</small>
            </div>
            <div>
              <span>Average per priced call</span>
              <strong>{usd(average)}</strong>
              <small>USD</small>
            </div>
            <div>
              <span>Tokens</span>
              <strong>{count.format(totals.inputTokens + totals.outputTokens)}</strong>
              <small>
                {count.format(totals.inputTokens)} in · {count.format(totals.outputTokens)} out
              </small>
            </div>
            <div>
              <span>Failed calls</span>
              <strong>{count.format(totals.failedCalls)}</strong>
              <small>Request errors</small>
            </div>
            <div>
              <span>Without reported cost</span>
              <strong>{count.format(totals.unpricedCalls)}</strong>
              <small>Not in the total</small>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="ai-cost-messages-heading"
          className="ai-cost-section ai-cost-panel"
        >
          <div className="ai-cost-panel-heading">
            <h2 id="ai-cost-messages-heading">Messages handled</h2>
            <span className="ai-cost-legend">{count.format(messages.total)} recorded messages</span>
          </div>
          {messages.total === 0 ? (
            <p className="ai-cost-empty">No handled messages were recorded in this period.</p>
          ) : (
            <>
              <div className="ai-cost-message-bar" aria-hidden="true">
                <span style={{ width: `${aiShare}%` }} />
              </div>
              <dl className="ai-cost-message-counts">
                <div>
                  <dt>
                    <span className="ai-cost-message-key" />
                    With AI
                  </dt>
                  <dd>
                    <strong>{count.format(messages.ai)}</strong>
                    <small>{percent.format(aiShare)}%</small>
                  </dd>
                </div>
                <div>
                  <dt>
                    <span className="ai-cost-message-key" data-without-ai />
                    Without AI
                  </dt>
                  <dd>
                    <strong>{count.format(messages.withoutAi)}</strong>
                    <small>{percent.format(100 - aiShare)}%</small>
                  </dd>
                </div>
              </dl>
            </>
          )}
          <p className="ai-cost-note">
            Counts cover the selected period and configured Slack channel. Each successfully handled
            message is counted once, on its first successful handling date in Copenhagen. A message
            counts as with AI if any processing used AI. Retries and edits do not add messages;
            deleted messages remain counted. Tracking starts with this feature, so earlier messages
            are not included.
          </p>
        </section>

        <section aria-labelledby="ai-cost-daily-heading" className="ai-cost-section ai-cost-panel">
          <div className="ai-cost-panel-heading">
            <h2 id="ai-cost-daily-heading">Daily cost</h2>
            <span className="ai-cost-legend" aria-hidden="true">
              <span className="ai-cost-legend-unpriced" /> Includes calls without reported cost
            </span>
          </div>
          {totals.calls === 0 ? (
            <p className="ai-cost-empty">No AI calls were recorded in this period.</p>
          ) : (
            <DailyChart daily={data.daily} />
          )}
        </section>

        <div className="ai-cost-columns">
          <section
            aria-labelledby="ai-cost-month-heading"
            className="ai-cost-section ai-cost-panel"
          >
            <h2 id="ai-cost-month-heading">By month</h2>
            <dl className="ai-cost-months">
              <div>
                <dt>{monthLabel(data.currentMonth.start)} so far</dt>
                <dd>
                  <strong>{costLabel(data.currentMonth)}</strong>
                  <small>{calls(data.currentMonth.calls)}</small>
                </dd>
              </div>
              <div>
                <dt>{monthLabel(data.previousMonth.start)}</dt>
                <dd>
                  <strong>{costLabel(data.previousMonth)}</strong>
                  <small>{calls(data.previousMonth.calls)}</small>
                </dd>
              </div>
            </dl>
          </section>

          <section
            aria-labelledby="ai-cost-model-heading"
            className="ai-cost-section ai-cost-panel"
          >
            <h2 id="ai-cost-model-heading">By model</h2>
            {data.models.length === 0 ? (
              <p className="ai-cost-empty">No models were used in this period.</p>
            ) : (
              <div className="ai-cost-table-scroll">
                <table className="ai-cost-table">
                  <thead>
                    <tr>
                      <th scope="col">Model</th>
                      <th scope="col">Calls</th>
                      <th scope="col">Failed</th>
                      <th scope="col">Tokens in</th>
                      <th scope="col">Tokens out</th>
                      <th scope="col">Cost (USD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.models.map((model) => (
                      <tr key={model.model}>
                        <th scope="row">{model.model}</th>
                        <td>{count.format(model.calls)}</td>
                        <td>{count.format(model.failedCalls)}</td>
                        <td>{count.format(model.inputTokens)}</td>
                        <td>{count.format(model.outputTokens)}</td>
                        <td>{costLabel(model)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <p className="ai-cost-note">
          Figures come from the cost AI Gateway reports for each request and cover the configured
          Slack channel, including retries, edits and deleted messages. Missing costs are not
          estimated; a total marked “+ unknown” leaves out calls without a reported cost. Days and
          months follow the request start time in Copenhagen. Conversion rates are on{' '}
          <Link href="/message-quality">Review</Link>.
        </p>
      </div>
    </main>
  );
}
