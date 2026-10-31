'use client';

import React, { useId, useState } from 'react';
import { count } from '@/lib/ai-cost/format';
import type { DailyMessageCounts, MessageCounts } from '@/lib/ai-cost/stats';
import { DailyMessagesTable, MessageTrend } from './MessageTrend';

const views = [
  ['trend', 'Trend'],
  ['summary', 'Summary'],
  ['bars', 'Bars'],
  ['donut', 'Donut'],
  ['table', 'Table'],
] as const;
type View = (typeof views)[number][0];
const percent = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });

type MessageViewProps = { messages: MessageCounts; dailyMessages?: DailyMessageCounts[] };

export function MessagesHandledView({
  messages,
  dailyMessages = [],
  view,
}: MessageViewProps & { view: View }) {
  if (messages.total === 0) {
    return <p className="ai-cost-empty">No handled messages were recorded in this period.</p>;
  }
  const aiShare = (messages.ai / messages.total) * 100;
  const categories = [
    { label: 'With AI', value: messages.ai, share: aiShare, withoutAi: false },
    { label: 'Without AI', value: messages.withoutAi, share: 100 - aiShare, withoutAi: true },
  ];
  if (view === 'table') {
    return (
      <>
        <div className="ai-cost-table-scroll">
          <table className="ai-cost-table">
            <caption className="sr-only">Handled messages by AI usage</caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Messages</th>
                <th scope="col">Share</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(({ label, value, share }) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{count.format(value)}</td>
                  <td>{percent.format(share)}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                <td>{count.format(messages.total)}</td>
                <td>100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {dailyMessages.length > 0 && <DailyMessagesTable dailyMessages={dailyMessages} />}
      </>
    );
  }
  const counts = (
    <dl className={`ai-cost-message-counts${view === 'bars' ? ' ai-cost-message-bars' : ''}`}>
      {categories.map(({ label, value, share, withoutAi }) => (
        <div key={label}>
          <dt>
            <span className="ai-cost-message-key" data-without-ai={withoutAi || undefined} />
            {label}
          </dt>
          <dd>
            <strong>{count.format(value)}</strong>
            <small>{percent.format(share)}%</small>
          </dd>
          {view === 'bars' && (
            <div className="ai-cost-message-track" aria-hidden="true">
              <span data-without-ai={withoutAi || undefined} style={{ width: `${share}%` }} />
            </div>
          )}
        </div>
      ))}
    </dl>
  );
  if (view === 'donut') {
    return (
      <div className="ai-cost-message-donut-view">
        <div
          className="ai-cost-message-donut"
          aria-hidden="true"
          style={{
            background: `conic-gradient(var(--ai-cost-link) ${aiShare}%, var(--ai-cost-raised) 0)`,
          }}
        >
          <span>
            <strong>{count.format(messages.total)}</strong>
            <small>Messages</small>
          </span>
        </div>
        {counts}
      </div>
    );
  }
  return (
    <>
      {view === 'summary' && (
        <div className="ai-cost-message-bar" aria-hidden="true">
          <span style={{ width: `${aiShare}%` }} />
        </div>
      )}
      {view === 'trend' && <MessageTrend dailyMessages={dailyMessages} />}
      {counts}
    </>
  );
}

export function MessagesHandledPanel({ messages, dailyMessages = [] }: MessageViewProps) {
  const [view, setView] = useState<View>('trend');
  const headingId = useId();
  const panelId = useId();
  return (
    <section aria-labelledby={headingId} className="ai-cost-section ai-cost-panel">
      <div className="ai-cost-panel-heading">
        <div>
          <h2 id={headingId}>Messages handled</h2>
          <span className="ai-cost-legend">{count.format(messages.total)} recorded messages</span>
        </div>
        <div className="ai-cost-views" role="group" aria-label="Messages handled view">
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
      <div id={panelId}>
        <MessagesHandledView messages={messages} dailyMessages={dailyMessages} view={view} />
      </div>
      <p className="ai-cost-note">
        Counts cover the selected period and configured Slack channel. Each successfully handled
        message is counted once, on its first successful handling date in Copenhagen. A message
        counts as with AI if any processing used AI. Retries and edits do not add messages; deleted
        messages remain counted. Tracking starts with this feature, so earlier messages are not
        included.
      </p>
    </section>
  );
}
