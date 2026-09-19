'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Search, X } from 'lucide-react';
import type { UserWithExtras } from '@/db/types';
import { Status } from '@/components/ui/Status/Status';
import { ProfileListItem } from '@/components/ui/ProfileListItem/ProfileListItem';
import { getSlackImageUrl } from '@/lib/slack/image';

export const personName = (person: UserWithExtras) =>
  [person.firstName, person.lastName].filter(Boolean).join(' ') || person.email;
export const isInOffice = (person: UserWithExtras) => person.status?.status === 'IN_OFFICE';

export function PeoplePanel({
  profiles,
  selectedId,
  onSelect,
}: {
  profiles: UserWithExtras[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const inOffice = profiles.filter(isInOffice);
  const selected = profiles.find((person) => person.userId === selectedId);
  const visible = profiles.filter(
    (person) =>
      personName(person).toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
      (filter === 'all' || (filter === 'office' ? isInOffice(person) : !isInOffice(person)))
  );
  const groups = [
    { label: 'In office', people: visible.filter(isInOffice) },
    { label: 'Elsewhere / expected', people: visible.filter((person) => !isInOffice(person)) },
  ];
  return (
    <aside className="people-panel" aria-label="People and statuses">
      <div className="people-panel-header">
        <h2>
          People <span>{profiles.length}</span>
        </h2>
        <label className="people-search">
          <Search size={18} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a colleague..."
            aria-label="Find a colleague"
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        </label>
        <div className="people-filters" aria-label="Filter people">
          {[
            ['all', 'All', profiles.length],
            ['office', 'In office', inOffice.length],
            ['elsewhere', 'Elsewhere', profiles.length - inOffice.length],
          ].map(([value, label, count]) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(String(value))}
            >
              {label} <span>{count}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="people-scroll">
        {groups.map(
          (group) =>
            group.people.length > 0 && (
              <section key={group.label} aria-label={group.label}>
                <h3>
                  {group.label} <span>{group.people.length}</span>
                </h3>
                <ul>
                  {group.people.map((person) => {
                    const picture = getSlackImageUrl(person.profilePicture);
                    return (
                      <li key={person.userId}>
                        <button
                          className="person-row"
                          aria-pressed={selectedId === person.userId}
                          onClick={() =>
                            onSelect(selectedId === person.userId ? null : person.userId)
                          }
                        >
                          <span className="person-avatar">
                            {picture ? (
                              <Image src={picture} alt="" width={36} height={36} unoptimized />
                            ) : (
                              personName(person)
                                .split(' ')
                                .map((part) => part[0])
                                .slice(0, 2)
                                .join('')
                            )}
                            <i className={isInOffice(person) ? 'present' : ''} />
                          </span>
                          <span className="person-summary">
                            <span>{personName(person)}</span>
                            {person.status?.details && <small>{person.status.details}</small>}
                          </span>
                          {person.status?.status ? (
                            <Status status={person.status.status} />
                          ) : (
                            <span className="pending-status">No status yet</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )
        )}
        {!visible.length && (
          <p className="people-empty">
            {profiles.length ? 'No colleagues match your search.' : 'No colleagues to show yet.'}
          </p>
        )}
      </div>
      {selected && (
        <section className="person-details" aria-label="Selected colleague">
          <button
            className="person-details-close"
            onClick={() => onSelect(null)}
            aria-label="Close colleague details"
          >
            <X size={18} />
          </button>
          <ProfileListItem user={selected} showStatus />
        </section>
      )}
    </aside>
  );
}
