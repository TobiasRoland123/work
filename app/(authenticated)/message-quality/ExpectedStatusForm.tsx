'use client';

import { useId, useRef, useState, useTransition } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { saveExpectedStatusAction } from '@/app/actions/messageQualityActions';
import type { UserStatus } from '@/db/types';

const statusLabels: Record<UserStatus, string> = {
  IN_OFFICE: 'In Office',
  FROM_HOME: 'From Home',
  AT_CLIENT: 'At Client',
  SICK: 'Sick',
  IN_LATE: 'In Late',
  LEAVING_EARLY: 'Leaving Early',
  VACATION: 'Vacation',
  CHILD_SICK: 'Child Sick',
  ON_LEAVE: 'On Leave',
  AWAY: 'Away',
};

type Props = {
  messageKey: string;
  revision: string;
  expectedStatus: UserStatus | null;
  expectedStatusNote: string | null;
};

export function ExpectedStatusForm({
  messageKey,
  revision,
  expectedStatus,
  expectedStatusNote,
}: Props) {
  const id = useId();
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState({ status: expectedStatus, note: expectedStatusNote });
  const [status, setStatus] = useState<UserStatus | ''>(expectedStatus ?? '');
  const [note, setNote] = useState(expectedStatusNote ?? '');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function resetDraft() {
    setStatus(saved.status ?? '');
    setNote(saved.note ?? '');
    setError(null);
    setSuccess(false);
  }

  function cancel() {
    resetDraft();
    setEditing(false);
    triggerRef.current?.focus();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !status) return;
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      try {
        const result = await saveExpectedStatusAction({ messageKey, revision, status, note });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setSaved({ status, note: note.trim() || null });
        setEditing(false);
        setSuccess(true);
        router.refresh();
      } catch {
        setError('Could not save the expected status. Please try again.');
      }
    });
  }

  return (
    <div className="quality-expected-status">
      {saved.status && (
        <div className="quality-expected-summary">
          <p>
            <span>Expected status</span> <strong>{statusLabels[saved.status]}</strong>
          </p>
          {saved.note && <p className="quality-expected-note">{saved.note}</p>}
        </div>
      )}
      <button
        ref={triggerRef}
        type="button"
        className="quality-expected-button"
        aria-expanded={editing}
        aria-controls={`${id}-form`}
        disabled={pending}
        onClick={() => {
          if (editing) {
            cancel();
          } else {
            resetDraft();
            setEditing(true);
          }
        }}
      >
        {saved.status ? 'Edit expected status' : 'Set expected status'}
      </button>
      {editing && (
        <form
          id={`${id}-form`}
          className="quality-expected-form"
          onSubmit={submit}
          aria-busy={pending}
        >
          <p id={`${id}-help`} className="quality-muted">
            This records your expected interpretation for review.
          </p>
          <div className="quality-expected-field">
            <label htmlFor={`${id}-status`}>Expected status</label>
            <select
              id={`${id}-status`}
              value={status}
              onChange={(event) => setStatus(event.target.value as UserStatus | '')}
              aria-describedby={`${id}-help`}
              disabled={pending}
              required
              autoFocus
            >
              <option value="" disabled>
                Choose a status
              </option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="quality-expected-field">
            <label htmlFor={`${id}-note`}>Note, optional</label>
            <textarea
              id={`${id}-note`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={2000}
              rows={3}
              disabled={pending}
            />
          </div>
          {error && (
            <p className="quality-expected-error" role="alert">
              {error}
            </p>
          )}
          <div className="quality-expected-actions">
            <button
              type="submit"
              className="quality-expected-button quality-expected-save"
              disabled={pending || !status}
            >
              {pending ? 'Saving…' : 'Save expected status'}
            </button>
            <button
              type="button"
              className="quality-expected-button"
              onClick={cancel}
              disabled={pending}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {success && (
        <p className="quality-expected-success quality-muted" role="status">
          Expected status saved.
        </p>
      )}
    </div>
  );
}
