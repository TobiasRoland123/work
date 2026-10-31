'use client';

import { useState } from 'react';
import { Plus, Star, X } from 'lucide-react';
import type { UserWithExtras } from '@/db/types';
import { StatusEmoji } from '@/components/ui/Status/StatusEmoji';
import { Avatar } from './Avatar';
import { dayNote, isAssumed, personName, presenceOf, statusTypes } from './presence';

const MAX_SUGGESTIONS = 6;

/** The status behind the live headcount, falling back to what the person announced. */
const statusOn = (person: UserWithExtras, day: string) => {
  const entry = person.week?.find((candidate) => candidate.date === day);
  return entry?.status ?? entry?.announcement ?? null;
};

const rank = (person: UserWithExtras, day: string) => {
  const type = statusOn(person, day)?.status;
  const index = type ? statusTypes.indexOf(type) : -1;
  return index === -1 ? statusTypes.length : index;
};

/** Pins sorted so the colleagues who are in the office come first, otherwise in pin order. */
export function sortPinned(
  people: readonly UserWithExtras[],
  pinnedIds: readonly string[],
  day: string
) {
  const byId = new Map(people.map((person) => [person.userId, person]));
  return pinnedIds
    .flatMap((id) => byId.get(id) ?? [])
    .map((person, order) => ({ person, order }))
    .sort((a, b) => rank(a.person, day) - rank(b.person, day) || a.order - b.order)
    .map(({ person }) => person);
}

function matches(person: UserWithExtras, needle: string) {
  return [personName(person), ...(person.organisationRoles ?? [])]
    .join(' ')
    .toLocaleLowerCase()
    .includes(needle);
}

function AddColleague({
  candidates,
  onPin,
}: {
  candidates: readonly UserWithExtras[];
  onPin: (userId: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const needle = query.trim().toLocaleLowerCase();
  const found = needle ? candidates.filter((person) => matches(person, needle)) : [];
  const suggestions = found.slice(0, MAX_SUGGESTIONS);

  const close = () => {
    setAdding(false);
    setQuery('');
  };
  const pin = (person: UserWithExtras) => {
    onPin(person.userId);
    close();
  };

  if (!adding) {
    return (
      <button className="day-panel-add" onClick={() => setAdding(true)}>
        <Plus size={15} aria-hidden="true" />
        Add a colleague…
      </button>
    );
  }
  return (
    <div className="day-panel-find">
      <div className="day-panel-find-field">
        <input
          // The field only appears after the person asks to add someone.
          autoFocus
          type="search"
          value={query}
          placeholder="Search by name or role"
          aria-label="Find a colleague to pin"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') close();
            if (event.key === 'Enter' && suggestions[0]) pin(suggestions[0]);
          }}
        />
        <button onClick={close} aria-label="Cancel adding a colleague">
          <X size={15} aria-hidden="true" />
        </button>
      </div>
      {needle &&
        (suggestions.length ? (
          <ul aria-label="Colleagues to pin">
            {suggestions.map((person) => (
              <li key={person.userId}>
                <button
                  className="day-panel-row"
                  onClick={() => pin(person)}
                  aria-label={`Pin ${personName(person)}`}
                >
                  <Avatar person={person} size={28} />
                  <span className="day-panel-person">
                    <span>{personName(person)}</span>
                    {person.organisationRoles?.[0] && <small>{person.organisationRoles[0]}</small>}
                  </span>
                  <Plus size={15} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="day-panel-empty">No colleagues match.</p>
        ))}
    </div>
  );
}

/** The signed-in person's shortlist of colleagues, with their status on the selected day. */
export function PinnedColleagues({
  people,
  pinnedIds,
  day,
  onOpen,
  onPinChange,
}: {
  /** Everyone who can be pinned: the directory without the signed-in person. */
  people: readonly UserWithExtras[];
  pinnedIds: readonly string[];
  day: string;
  onOpen: (userId: string) => void;
  onPinChange: (userId: string, pinned: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const pinned = sortPinned(people, pinnedIds, day);
  const pinnedSet = new Set(pinned.map((person) => person.userId));
  const candidates = people.filter((person) => !pinnedSet.has(person.userId));
  const inOffice = pinned.filter((person) => statusOn(person, day)?.status === 'IN_OFFICE').length;
  const arriving = pinned.filter((person) => statusOn(person, day)?.status === 'IN_LATE').length;
  const editable = editing && pinned.length > 0;

  return (
    <section className="day-panel-group day-panel-pins" aria-label="Pinned colleagues">
      <h3>
        <Star size={13} aria-hidden="true" />
        Pinned <span>{pinned.length}</span>
        {pinned.length > 0 && (
          <button
            className="day-panel-link"
            aria-pressed={editable}
            onClick={() => setEditing(!editing)}
          >
            {editable ? 'Done' : 'Edit'}
          </button>
        )}
      </h3>
      {pinned.length ? (
        <ul>
          {pinned.map((person) => {
            const status = statusOn(person, day);
            const { label, tone } = presenceOf(status);
            const note = dayNote(status);
            const assumed = isAssumed(status);
            return (
              <li key={person.userId}>
                <button
                  className="day-panel-row"
                  onClick={() => onOpen(person.userId)}
                  title={assumed ? `${label} · assumed, nothing announced` : undefined}
                >
                  <Avatar person={person} size={32} />
                  <span className="day-panel-person">
                    <span>{personName(person)}</span>
                    <small>
                      <StatusEmoji
                        status={status?.status ?? null}
                        emoji={status?.emoji}
                        details={status?.details}
                      />
                      {label}
                      {note && ` · ${note}`}
                      {assumed && <span className="sr-only"> (assumed)</span>}
                    </small>
                  </span>
                  <i className="tone-dot tone" data-tone={tone} aria-hidden="true" />
                </button>
                {editable && (
                  <button
                    className="day-panel-unpin"
                    onClick={() => onPinChange(person.userId, false)}
                    aria-label={`Unpin ${personName(person)}`}
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="day-panel-empty">
          Pin the colleagues you work with most to see at a glance whether they are in.
        </p>
      )}
      <AddColleague candidates={candidates} onPin={(userId) => onPinChange(userId, true)} />
      {pinned.length > 0 && (
        <p className="day-panel-pin-summary">
          {inOffice} of {pinned.length} in the office
          {arriving > 0 && ` · ${arriving} arriving later`}
        </p>
      )}
    </section>
  );
}
