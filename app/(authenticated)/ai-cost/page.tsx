import React from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { requirePageUserId } from '@/lib/auth/require-user';
import { requireMessageReviewer } from '@/lib/auth/message-review';
import { getAiCostDashboard } from '@/lib/ai-cost/service';
import { calls, costLabel, count, dayLabel, monthLabel, usd } from '@/lib/ai-cost/format';
import { DailyCostPanel } from './DailyCostPanel';
import { MessagesHandledPanel } from './MessagesHandledPanel';
import { AI_COST_PERIODS, averageCostPerPricedCall } from '@/lib/ai-cost/stats';
import './ai-cost.css';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ days?: string | string[] }>;

const one = (value: string | string[] | undefined) =>
  typeof value === 'string' ? value : undefined;

export default async function AiCostPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePageUserId();
  await requireMessageReviewer();
  const params = await searchParams;
  const data = await getAiCostDashboard({ days: one(params.days) });
  const { totals, messages } = data;
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

        <MessagesHandledPanel messages={messages} dailyMessages={data.dailyMessages} />

        <DailyCostPanel daily={data.daily} />

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
