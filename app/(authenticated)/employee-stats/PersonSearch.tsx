'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export type SearchPerson = { userId: string; name: string; email: string };

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const COMPACT_LIMIT = 8;

/**
 * Find an employee by name or email. The list variant shows everyone who matches; the compact
 * variant is a drop-down for use on a person's page. Without JavaScript the form reloads the
 * employees page with the search applied.
 */
export function PersonSearch({
  people,
  initialQuery = '',
  linkSuffix = '',
  variant = 'list',
}: {
  people: readonly SearchPerson[];
  initialQuery?: string;
  /** Appended to each person's link, such as the period and comparison to keep. */
  linkSuffix?: string;
  variant?: 'list' | 'compact';
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const compact = variant === 'compact';

  const matches = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    if (compact && words.length === 0) return [];
    const found = people.filter((person) => {
      const haystack = normalize(`${person.name} ${person.email}`);
      return words.every((word) => haystack.includes(word));
    });
    return compact ? found.slice(0, COMPACT_LIMIT) : found;
  }, [people, query, compact]);

  const hrefOf = (person: SearchPerson) => `/employee-stats/people/${person.userId}${linkSuffix}`;

  return (
    <div className="stats-search" data-variant={variant}>
      <form
        role="search"
        action="/employee-stats/people"
        method="get"
        onSubmit={(event) => {
          event.preventDefault();
          if (compact && matches[0]) router.push(hrefOf(matches[0]));
        }}
      >
        <label>
          <span>Search employees</span>
          <input
            type="search"
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name or email"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
      </form>

      {(!compact || query.trim() !== '') && (
        <ul className="stats-search-results" aria-label="Matching employees">
          {matches.map((person) => (
            <li key={person.userId}>
              <Link href={hrefOf(person)}>
                <strong>{person.name}</strong>
                {person.name !== person.email && <small>{person.email}</small>}
              </Link>
            </li>
          ))}
          {matches.length === 0 && <li className="stats-search-empty">No employees match.</li>}
        </ul>
      )}
      {!compact && (
        <p className="stats-muted" role="status">
          {matches.length} of {people.length} employees
        </p>
      )}
    </div>
  );
}
