import React from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { requirePageUserId } from '@/lib/auth/require-user';
import { requireMessageReviewer } from '@/lib/auth/message-review';
import { getMessageQualityDashboard } from '@/lib/message-quality/service';
import type { AiCostSummary, WeeklyConversion, ReviewMessage } from '@/lib/message-quality/service';
import { ExpectedStatusForm } from './ExpectedStatusForm';
import './message-quality.css';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{
  week?: string | string[];
  reason?: string | string[];
  page?: string | string[];
}>;

const one = (value: string | string[] | undefined) =>
  typeof value === 'string' ? value : undefined;

function aiCostLabel({ costUsd, calls, unpricedCalls }: AiCostSummary) {
  if (calls === 0) return 'No recorded AI calls';
  if (costUsd === null) return 'AI cost unavailable';
  const amount = costUsd > 0 && costUsd < 0.0001 ? '<$0.0001' : `$${costUsd.toFixed(4)}`;
  return `AI ${amount} USD${unpricedCalls > 0 ? ' + unknown' : ''}`;
}

function aiCostDescription(cost: AiCostSummary) {
  const { costUsd, calls, unpricedCalls } = cost;
  const callCount = `${calls} AI ${calls === 1 ? 'call' : 'calls'}`;
  if (calls === 0) return 'No recorded AI calls';
  if (costUsd === null) return `${callCount}; no reported costs available`;
  return `${aiCostLabel(cost)}; ${callCount}; ${unpricedCalls} without reported cost`;
}

function weekdayLabel(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}

function reviewUrl(week: string, reason = '', page = 1) {
  const params = new URLSearchParams({ week });
  if (reason) params.set('reason', reason);
  if (page > 1) params.set('page', String(page));
  return `/message-quality?${params.toString()}`;
}

function weekLabel(value: string) {
  const start = new Date(`${value}T12:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const format = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `${format.format(start)}–${format.format(end)}`;
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Copenhagen',
  }).format(new Date(value));
}

function reasonLabel(value: string) {
  if (value === 'not_recorded') return 'Not recorded';
  return value.replaceAll('_', ' ');
}

function WeekTile({
  week,
  selected,
  reason,
}: {
  week: WeeklyConversion;
  selected: boolean;
  reason: string;
}) {
  return (
    <Link
      className="quality-week"
      data-selected={selected || undefined}
      aria-current={selected ? 'page' : undefined}
      href={reviewUrl(week.weekStart, reason)}
    >
      <span className="quality-week-dates">{weekLabel(week.weekStart)}</span>
      <strong>{week.percentage === null ? 'N/A' : `${week.percentage}%`}</strong>
      <span className="quality-week-count">
        {week.converted} of {week.total} messages
      </span>
      <span className="quality-week-cost" aria-label={aiCostDescription(week.aiCost)}>
        {aiCostLabel(week.aiCost)}
      </span>
      <span
        className="quality-week-track"
        role="img"
        aria-label={week.percentage === null ? 'No messages' : `${week.percentage}% converted`}
      >
        <span style={{ width: `${week.percentage ?? 0}%` }} />
      </span>
    </Link>
  );
}

function MessageCard({ message }: { message: ReviewMessage }) {
  return (
    <article className="quality-message">
      <div className="quality-message-top">
        <div>
          <h3>{message.author}</h3>
        </div>
        <time dateTime={message.announcedAt}>{dateTime(message.announcedAt)}</time>
      </div>
      <p className="quality-message-text">
        {message.text?.trim() ? message.text : <em>Original text unavailable for this record</em>}
      </p>
      <dl className="quality-message-facts">
        <div>
          <dt>Created by this revision</dt>
          <dd>{message.reason === 'not_recorded' ? 'Not recorded' : 'No status'}</dd>
        </div>
        <div>
          <dt>Outcome</dt>
          <dd>{reasonLabel(message.reason)}</dd>
        </div>
        {message.failureReason && (
          <div>
            <dt>Failure</dt>
            <dd>{reasonLabel(message.failureReason)}</dd>
          </div>
        )}
      </dl>
      <ExpectedStatusForm
        key={message.revision}
        messageKey={message.messageKey}
        revision={message.revision}
        expectedStatus={message.expectedStatus}
        expectedStatusNote={message.expectedStatusNote}
      />
      <details className="quality-message-details">
        <summary>Technical details</summary>
        <dl>
          {message.slackUserId && (
            <div>
              <dt>Slack ID</dt>
              <dd>{message.slackUserId}</dd>
            </div>
          )}
          <div>
            <dt>Message key</dt>
            <dd>{message.messageKey}</dd>
          </div>
          <div>
            <dt>Revision</dt>
            <dd>{message.revision}</dd>
          </div>
          <div>
            <dt>Received</dt>
            <dd>{dateTime(message.receivedAt)}</dd>
          </div>
          <div>
            <dt>State</dt>
            <dd>{reasonLabel(message.state)}</dd>
          </div>
          <div>
            <dt>Attempts</dt>
            <dd>{message.attempts}</dd>
          </div>
          <div>
            <dt>Processed</dt>
            <dd>{message.processedAt ? dateTime(message.processedAt) : 'Not recorded'}</dd>
          </div>
        </dl>
      </details>
    </article>
  );
}

export default async function MessageQualityPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePageUserId();
  await requireMessageReviewer();
  const params = await searchParams;
  const data = await getMessageQualityDashboard({
    week: one(params.week),
    reason: one(params.reason),
    page: one(params.page),
  });
  const summary = data.selectedSummary;

  return (
    <main id="dashboard-main" className="content-page quality-page">
      <PageHeader
        title="Message quality"
        subtitle="Accepted Slack messages and saved status outcomes"
      />
      <div className="content-page-body quality-body">
        <section aria-labelledby="quality-trend-heading" className="quality-section">
          <div className="quality-heading-row">
            <div>
              <h2 id="quality-trend-heading">Weekly conversion</h2>
              <p>
                Messages that produced at least one attendance status, by original message week.
              </p>
            </div>
          </div>
          <div className="quality-weeks">
            {data.weeks.map((week) => (
              <WeekTile
                key={week.weekStart}
                week={week}
                selected={week.weekStart === data.selectedWeek}
                reason={data.reason}
              />
            ))}
          </div>
          <section className="quality-daily-costs" aria-labelledby="quality-daily-costs-heading">
            <div className="quality-daily-costs-heading">
              <h3 id="quality-daily-costs-heading">
                AI cost for week of {weekLabel(data.selectedWeek)}
              </h3>
              <strong aria-label={aiCostDescription(summary.aiCost)}>
                {aiCostLabel(summary.aiCost)}
              </strong>
            </div>
            <div className="quality-daily-costs-grid">
              {data.dailyCosts.map((day) => (
                <div className="quality-daily-cost" key={day.date}>
                  <span>{weekdayLabel(day.date)}</span>
                  <strong aria-label={aiCostDescription(day)}>{aiCostLabel(day)}</strong>
                  <small>
                    {day.calls} {day.calls === 1 ? 'call' : 'calls'}
                    {day.unpricedCalls > 0 ? ` · ${day.unpricedCalls} unpriced` : ''}
                  </small>
                </div>
              ))}
            </div>
            <p className="quality-note">
              Costs are grouped by the day AI processed each message, in Copenhagen time, and
              include retries. Totals include reported USD charges; unpriced calls are shown
              separately.
            </p>
          </section>
          <p className="quality-note">
            Conversion is an import outcome, not a measure of accuracy. Weeks run Monday through
            Sunday in Copenhagen. Pending messages count toward the total while processing
            continues; edits count once at their latest revision and deleted messages are excluded.
          </p>
        </section>

        <section aria-labelledby="quality-review-heading" className="quality-section">
          <div className="quality-heading-row">
            <div>
              <h2 id="quality-review-heading">Messages without a status</h2>
              <p>
                Week of {weekLabel(data.selectedWeek)} · {data.totalMessages} to review ·{' '}
                {summary.percentage === null
                  ? 'Conversion N/A'
                  : `${summary.percentage}% converted`}
              </p>
            </div>
            <form method="get" action="/message-quality" className="quality-filter">
              <label htmlFor="quality-week-date">Week containing</label>
              <input
                id="quality-week-date"
                type="date"
                name="week"
                defaultValue={data.selectedWeek}
              />
              <label htmlFor="quality-reason">Reason</label>
              <select id="quality-reason" name="reason" defaultValue={data.reason}>
                <option value="">All reasons</option>
                {data.reasons.map((reason) => (
                  <option value={reason} key={reason}>
                    {reasonLabel(reason)}
                  </option>
                ))}
              </select>
              <button type="submit">Filter</button>
            </form>
          </div>

          <div className="quality-summary" aria-label="Selected week totals">
            <div>
              <span>Total accepted</span>
              <strong>{summary.total}</strong>
            </div>
            <div>
              <span>Converted</span>
              <strong>{summary.converted}</strong>
            </div>
            <div>
              <span>No status</span>
              <strong>{summary.unconverted}</strong>
            </div>
            <div>
              <span>Unknown outcome</span>
              <strong>{summary.unknown}</strong>
            </div>
            <div>
              <span>Pending</span>
              <strong>{summary.pending}</strong>
            </div>
          </div>

          {data.messages.length ? (
            <div className="quality-messages">
              {data.messages.map((message) => (
                <MessageCard key={message.messageKey} message={message} />
              ))}
            </div>
          ) : (
            <p className="quality-empty">
              No messages without a status match this week and reason.
            </p>
          )}

          {data.totalPages > 1 && (
            <nav aria-label="Review pages" className="quality-pagination">
              {data.page > 1 && (
                <Link href={reviewUrl(data.selectedWeek, data.reason, data.page - 1)}>
                  Previous
                </Link>
              )}
              <span>
                Page {data.page} of {data.totalPages}
              </span>
              {data.page < data.totalPages && (
                <Link href={reviewUrl(data.selectedWeek, data.reason, data.page + 1)}>Next</Link>
              )}
            </nav>
          )}
        </section>
      </div>
    </main>
  );
}
