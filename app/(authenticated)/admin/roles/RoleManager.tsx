'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, LoaderCircle, Search } from 'lucide-react';
import { changeUserRoleAction } from '@/app/actions/roleActions';
import type { RoleEntry } from '@/lib/admin/roles';
import type { AppRole } from '@/lib/auth/role-policy';

const roleLabels: Record<AppRole, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee',
};

export function RoleManager({
  entries,
  adminUserId,
}: {
  entries: RoleEntry[];
  adminUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const needle = query.trim().toLowerCase();
  const visible = entries.filter(
    ({ name, email }) =>
      !needle || name.toLowerCase().includes(needle) || email.toLowerCase().includes(needle)
  );

  function change(entry: RoleEntry, role: AppRole) {
    if (pending || role === entry.role) return;
    setMessage(null);
    setPendingUserId(entry.userId);
    startTransition(async () => {
      try {
        const result = await changeUserRoleAction({ userId: entry.userId, role });
        setMessage(
          result.ok
            ? { text: `${entry.name} now has the ${roleLabels[role]} role.`, error: false }
            : { text: result.error, error: true }
        );
        if (result.ok) router.refresh();
      } catch {
        setMessage({ text: 'Could not change the role. Please try again.', error: true });
      } finally {
        setPendingUserId(null);
      }
    });
  }

  return (
    <section className="roles-panel" aria-labelledby="workspace-roles">
      <div className="roles-panel-header">
        <div className="roles-panel-title">
          <h2 id="workspace-roles">People</h2>
          <span className="roles-count">
            {needle ? `${visible.length} of ${entries.length}` : entries.length}
          </span>
        </div>
        <label className="roles-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            aria-label="Search people"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or email"
            autoComplete="off"
          />
        </label>
      </div>
      <div
        role="status"
        className={message ? 'roles-feedback' : 'sr-only'}
        data-error={message?.error ? '' : undefined}
      >
        {message?.text}
      </div>
      {visible.length === 0 ? (
        <p className="roles-empty">Nobody matches your search.</p>
      ) : (
        <>
          <div className="roles-column-headings" aria-hidden="true">
            <span>Workspace member</span>
            <span>Role</span>
          </div>
          <ul className="roles-list">
            {visible.map((entry) => (
              <li key={entry.userId} className="roles-row">
                <div className="roles-person">
                  <div className="roles-person-name">
                    <strong title={entry.name}>{entry.name}</strong>
                    {entry.userId === adminUserId ? <span className="roles-you">You</span> : null}
                  </div>
                  <span className="roles-email" title={entry.email}>
                    {entry.email}
                  </span>
                </div>
                {entry.userId === adminUserId ? (
                  <span className="roles-role roles-role-static" data-role="ADMIN">
                    Admin
                  </span>
                ) : (
                  <div
                    className="roles-role"
                    data-role={entry.role}
                    aria-busy={pendingUserId === entry.userId}
                  >
                    <select
                      aria-label={`Role for ${entry.name}`}
                      value={entry.role}
                      disabled={pending}
                      onChange={(event) => change(entry, event.target.value as AppRole)}
                    >
                      {Object.entries(roleLabels).map(([role, label]) => (
                        <option key={role} value={role}>
                          {label}
                        </option>
                      ))}
                    </select>
                    {pendingUserId === entry.userId ? (
                      <LoaderCircle size={14} className="roles-saving" aria-hidden="true" />
                    ) : (
                      <ChevronDown size={14} aria-hidden="true" />
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
