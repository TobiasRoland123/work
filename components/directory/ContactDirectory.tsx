'use client';

import { getSlackImageUrl } from '@/lib/slack/image';
import type { UserWithExtras } from '@/db/types';
import Image from 'next/image';
import { useState } from 'react';
import './directory.css';

export interface ContactDirectoryProps {
  users: UserWithExtras[];
}

const personName = (user: UserWithExtras) =>
  [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email;

const initials = (user: UserWithExtras) =>
  (
    [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join('') || user.email.slice(0, 2)
  ).toUpperCase();

export default function ContactDirectory({ users }: ContactDirectoryProps) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredUsers = users.filter((user) => {
    if (!normalizedQuery) return true;
    const searchable = [
      personName(user),
      user.email,
      user.organisation,
      ...(user.organisationRoles ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase();
    return searchable.includes(normalizedQuery);
  });

  return (
    <section className="contact-directory" aria-labelledby="contact-directory-title">
      <header className="contact-directory__header">
        <div>
          <p className="contact-directory__eyebrow">People</p>
          <h2 id="contact-directory-title">Contact directory</h2>
          <p className="contact-directory__intro">Find a colleague and get in touch.</p>
        </div>
        <span className="contact-directory__count" aria-live="polite">
          {filteredUsers.length} {filteredUsers.length === 1 ? 'person' : 'people'}
        </span>
      </header>

      <label className="contact-directory__search">
        <span className="contact-directory__search-icon" aria-hidden="true">
          ⌕
        </span>
        <span className="sr-only">Search people</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, email, or role"
          autoComplete="off"
        />
      </label>

      {filteredUsers.length ? (
        <ul className="contact-directory__grid">
          {filteredUsers.map((user) => {
            const name = personName(user);
            const imageUrl = getSlackImageUrl(user.profilePicture);
            const phone = user.businessPhoneNumber || user.mobilePhone;
            const roles = user.organisationRoles?.filter(Boolean) ?? [];
            return (
              <li className="contact-card" key={user.userId}>
                <div className="contact-card__topline">
                  <div className="contact-card__avatar">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        unoptimized
                        alt={`Profile picture of ${name}`}
                        width={72}
                        height={72}
                      />
                    ) : (
                      <span role="img" aria-label={`Initials for ${name}`}>
                        {initials(user)}
                      </span>
                    )}
                  </div>
                  <div className="contact-card__identity">
                    <h3>{name}</h3>
                    {user.organisation ? <p>{user.organisation}</p> : null}
                  </div>
                </div>
                {roles.length ? (
                  <ul className="contact-card__roles" aria-label="Roles">
                    {roles.map((role) => (
                      <li key={role}>{role}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="contact-card__links">
                  <a href={`mailto:${user.email}`}>
                    <span aria-hidden="true">↗</span>
                    <span>{user.email}</span>
                  </a>
                  {phone ? (
                    <a href={`tel:${phone}`}>
                      <span aria-hidden="true">↗</span>
                      <span>{phone}</span>
                    </a>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="contact-directory__empty">No people match “{query}”.</p>
      )}
    </section>
  );
}

export { personName };
