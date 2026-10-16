'use client';

import { useId, useState, useTransition, type FormEvent } from 'react';
import { toast } from 'sonner';
import { correctImportedStatusAction } from '@/app/actions/statusActions';
import type { Status, UserStatus } from '@/db/types';
import { formatDay } from '@/lib/status/week';
import { presenceOf, statusLabel, statusTypes } from './presence';

const shortDay = (day: string) =>
  formatDay(day, { weekday: 'short', day: 'numeric', month: 'short' });

/** Lets a person replace the status Slack imported for one of their days. */
export function StatusCorrection({
  status,
  date,
  onSaved,
}: {
  /** The resolved, imported status shown for `date`. */
  status: Status;
  date: string;
  onSaved: () => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<UserStatus | ''>('');
  const [scope, setScope] = useState<'day' | 'declaration'>('day');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { label } = presenceOf(status);
  const multiDay = Boolean(status.fromDate && status.toDate && status.fromDate !== status.toDate);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !choice) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await correctImportedStatusAction({
          statusId: status.id,
          day: date,
          scope: multiDay ? scope : 'day',
          status: choice,
        });
        // Keep the selection on failure so the person can retry without choosing again.
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast(
          result.duplicate
            ? 'This correction was already saved'
            : 'Status corrected. Thanks, the mistake was recorded for review.'
        );
        setOpen(false);
        setChoice('');
        setScope('day');
        onSaved();
      } catch {
        setError('Could not save your correction. Check your connection and try again.');
      }
    });
  }

  if (!open)
    return (
      <button
        type="button"
        className="status-correction-toggle"
        aria-expanded={false}
        aria-controls={id + '-form'}
        onClick={() => setOpen(true)}
      >
        Wrong status?
      </button>
    );

  return (
    <form id={id + '-form'} className="status-correction" onSubmit={submit} aria-busy={pending}>
      <p id={id + '-help'}>
        {status.status ? (
          <>
            Slack read this as <strong>{label}</strong>.
          </>
        ) : (
          'Slack saved this as a note without a status.'
        )}{' '}
        Choose the right status. The mistake is recorded so the import can be improved.
      </p>
      <label htmlFor={id + '-status'}>Correct status</label>
      <select
        id={id + '-status'}
        value={choice}
        onChange={(event) => setChoice(event.target.value as UserStatus | '')}
        aria-describedby={id + '-help'}
        disabled={pending}
        required
        autoFocus
      >
        <option value="" disabled>
          Choose a status
        </option>
        {statusTypes
          .filter((value) => value !== status.status)
          .map((value) => (
            <option key={value} value={value}>
              {statusLabel(value)}
            </option>
          ))}
      </select>
      {multiDay && (
        <fieldset disabled={pending}>
          <legend>Apply to</legend>
          <label>
            <input
              type="radio"
              name={id + '-scope'}
              checked={scope === 'day'}
              onChange={() => setScope('day')}
            />
            Only {shortDay(date)}
          </label>
          <label>
            <input
              type="radio"
              name={id + '-scope'}
              checked={scope === 'declaration'}
              onChange={() => setScope('declaration')}
            />
            The whole announcement, {shortDay(status.fromDate!)} – {shortDay(status.toDate!)}
          </label>
        </fieldset>
      )}
      {error && (
        <p className="status-correction-error" role="alert">
          {error}
        </p>
      )}
      <div className="status-correction-actions">
        <button type="submit" className="status-correction-save" disabled={pending || !choice}>
          {pending ? 'Saving…' : 'Save correction'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={pending}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
