'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  grantEmployeeStatsAccessAction,
  revokeEmployeeStatsAccessAction,
} from '@/app/actions/employeeStatsActions';
import type { AccessEntry } from '@/lib/employee-stats/access';

const grantedOn = (value: string) =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'Europe/Copenhagen' }).format(
    new Date(value)
  );

type Message = { text: string; error: boolean };

export function AccessManager({
  entries,
  adminUserId,
}: {
  entries: AccessEntry[];
  adminUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<Message | null>(null);

  const needle = query.trim().toLowerCase();
  const visible = entries.filter(
    ({ name, email }) =>
      !needle || name.toLowerCase().includes(needle) || email.toLowerCase().includes(needle)
  );
  const withAccess = visible.filter(({ role }) => role !== 'none');
  const withoutAccess = visible.filter(({ role }) => role === 'none');
  const viewerCount = entries.filter(({ role }) => role === 'viewer').length;

  function change(entry: AccessEntry, grant: boolean) {
    if (pending) return;
    setMessage(null);
    setPendingUserId(entry.userId);
    startTransition(async () => {
      try {
        const action = grant ? grantEmployeeStatsAccessAction : revokeEmployeeStatsAccessAction;
        const result = await action({ userId: entry.userId });
        setMessage(
          result.ok
            ? {
                text: grant
                  ? `${entry.name} can now view the employee stats.`
                  : `${entry.name} can no longer view the employee stats.`,
                error: false,
              }
            : { text: result.error, error: true }
        );
        if (result.ok) router.refresh();
      } catch {
        setMessage({ text: 'Could not change access. Please try again.', error: true });
      } finally {
        setPendingUserId(null);
      }
    });
  }

  function renderList(label: string, rows: AccessEntry[], empty: string) {
    const headingId = `stats-access-${label.replace(/\W+/g, '-').toLowerCase()}`;
    return (
      <section aria-labelledby={headingId} className="stats-section stats-panel">
        <h2 id={headingId}>
          {label} <span className="stats-access-badge">{rows.length}</span>
        </h2>
        {rows.length === 0 ? (
          <p className="stats-empty">{empty}</p>
        ) : (
          <ul className="stats-access-list">
            {rows.map((entry) => (
              <li key={entry.userId} className="stats-access-row">
                <div className="stats-access-person">
                  <strong>
                    {entry.name}
                    {entry.userId === adminUserId && (
                      <span className="stats-access-badge">You · Admin</span>
                    )}
                  </strong>
                  <small>
                    {entry.email}
                    {entry.role === 'viewer' && entry.grantedAt
                      ? ` · Granted ${grantedOn(entry.grantedAt)}${entry.grantedBy ? ` by ${entry.grantedBy}` : ''}`
                      : ''}
                  </small>
                </div>
                {entry.role === 'viewer' && (
                  <button
                    type="button"
                    className="stats-access-button"
                    data-revoke
                    disabled={pending}
                    aria-label={`Revoke access for ${entry.name}`}
                    onClick={() => change(entry, false)}
                  >
                    {pendingUserId === entry.userId ? 'Revoking…' : 'Revoke'}
                  </button>
                )}
                {entry.role === 'none' && (
                  <button
                    type="button"
                    className="stats-access-button"
                    data-grant
                    disabled={pending}
                    aria-label={`Grant access to ${entry.name}`}
                    onClick={() => change(entry, true)}
                  >
                    {pendingUserId === entry.userId ? 'Granting…' : 'Grant access'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <>
      <div className="stats-access-toolbar">
        <label className="stats-access-search">
          <span>Search people</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name or email"
            autoComplete="off"
          />
        </label>
        <p className="stats-muted">
          {viewerCount === 0
            ? 'Only you can view the employee stats.'
            : `You and ${viewerCount} ${viewerCount === 1 ? 'person' : 'people'} can view the employee stats.`}
        </p>
      </div>
      <p role="status" className="stats-access-status" data-error={message?.error ? '' : undefined}>
        {message?.text}
      </p>
      {renderList('Can view stats', withAccess, 'Nobody matches your search.')}
      {renderList(
        'No access',
        withoutAccess,
        needle ? 'Nobody matches your search.' : 'Everyone can view the employee stats.'
      )}
    </>
  );
}
