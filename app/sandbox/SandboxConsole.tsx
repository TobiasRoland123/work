'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  createSandboxProfileAction,
  deleteSandboxMessageAction,
  editSandboxMessageAction,
  getSandboxOverview,
  resetSandboxDataAction,
  runSandboxRetriesAction,
  seedSandboxProfilesAction,
  sendSandboxMessageAction,
  signInAsSandboxProfileAction,
  signOutSandboxAction,
} from '@/app/actions/sandboxActions';
import type { SandboxOutcome, SandboxProfile } from '@/lib/sandbox/service';

type Overview = Awaited<ReturnType<typeof getSandboxOverview>>;

/** Scratch list of what was typed. Not truth: the inbox nulls text on every terminal outcome. */
type ChannelItem = {
  messageTs: string;
  slackUserId: string;
  text: string;
  announcedAt: string;
  lastOutcome: string;
};
const STORAGE_KEY = 'work.sandbox.channel';

const copenhagen = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Copenhagen',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const wallClock = (iso: string) => copenhagen.format(new Date(iso));
const wallClockOfTs = (ts: string) => copenhagen.format(new Date(Number(ts) * 1000));

function profileName(profile: Pick<SandboxProfile, 'firstName' | 'lastName'>) {
  return [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Unnamed';
}

function summarize(outcome: SandboxOutcome) {
  if (outcome.processing.kind === 'terminal')
    return `${outcome.processing.state}${outcome.processing.reason ? ` · ${outcome.processing.reason}` : ''}`;
  if (outcome.processing.kind === 'retry_scheduled')
    return `retry in ${outcome.processing.afterSeconds}s · ${outcome.processing.likelyReason}`;
  return outcome.intake.reason
    ? `${outcome.intake.outcome} · ${outcome.intake.reason}`
    : outcome.intake.outcome;
}

export function SandboxConsole({
  overview,
  samples,
  unmappedAuthor,
}: {
  overview: Overview;
  samples: { label: string; text: string }[];
  unmappedAuthor: { slackUserId: string; label: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const activeProfiles = overview.profiles.filter((profile) => !profile.slackDeactivated);
  const authors = [
    ...overview.profiles.map((profile) => ({
      slackUserId: profile.slackUserId,
      label: `${profileName(profile)}${profile.slackDeactivated ? ' (deactivated)' : ''}`,
    })),
    unmappedAuthor,
  ];
  const [author, setAuthor] = useState(authors[0]?.slackUserId ?? unmappedAuthor.slackUserId);
  const [text, setText] = useState('');
  const [announcedAt, setAnnouncedAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<SandboxOutcome | null>(null);
  const [channel, setChannel] = useState<ChannelItem[]>([]);
  const [editing, setEditing] = useState<{ messageTs: string; text: string } | null>(null);
  const [newProfile, setNewProfile] = useState({ firstName: '', lastName: '' });

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setChannel(JSON.parse(stored) as ChannelItem[]);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);
  function saveChannel(next: ChannelItem[]) {
    setChannel(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'The sandbox action failed.');
      }
      router.refresh();
    });
  }

  const send = () =>
    run(async () => {
      const response = await sendSandboxMessageAction({
        slackUserId: author,
        text,
        announcedAt: announcedAt || null,
      });
      if (!response.ok) return setError(response.error);
      setOutcome(response.result);
      saveChannel([
        {
          messageTs: response.result.messageTs,
          slackUserId: author,
          text: text.trim(),
          announcedAt: response.result.announcedAt,
          lastOutcome: summarize(response.result),
        },
        ...channel,
      ]);
      setText('');
    });

  const saveEdit = (item: ChannelItem) =>
    run(async () => {
      if (!editing) return;
      const response = await editSandboxMessageAction({
        slackUserId: item.slackUserId,
        messageTs: item.messageTs,
        text: editing.text,
      });
      if (!response.ok) return setError(response.error);
      setOutcome(response.result);
      saveChannel(
        channel.map((entry) =>
          entry.messageTs === item.messageTs
            ? { ...entry, text: editing.text.trim(), lastOutcome: summarize(response.result) }
            : entry
        )
      );
      setEditing(null);
    });

  const remove = (item: ChannelItem) =>
    run(async () => {
      const response = await deleteSandboxMessageAction({
        slackUserId: item.slackUserId,
        messageTs: item.messageTs,
      });
      if (!response.ok) return setError(response.error);
      setOutcome(response.result);
      saveChannel(channel.filter((entry) => entry.messageTs !== item.messageTs));
    });

  const reset = () =>
    run(async () => {
      if (
        !window.confirm(
          'Delete every Declaration and inbox row of the sandbox workspace (T_LOCAL) and clear this list? Profiles are kept.'
        )
      )
        return;
      const response = await resetSandboxDataAction();
      if (!response.ok) return setError(response.error);
      saveChannel([]);
      setOutcome(null);
      toast(
        `Deleted ${response.deleted.status} status rows and ${response.deleted.slackMessages} inbox rows.`
      );
    });

  const retries = () =>
    run(async () => {
      const response = await runSandboxRetriesAction();
      if (!response.ok) return setError(response.error);
      toast(`Retries: ${JSON.stringify(response.counts)}`);
    });

  const seed = () =>
    run(async () => {
      const response = await seedSandboxProfilesAction();
      if (!response.ok) return setError(response.error);
      toast(`Seeded ${response.profiles} fixture profiles.`);
    });

  const addProfile = () =>
    run(async () => {
      const response = await createSandboxProfileAction(newProfile);
      if (!response.ok) return setError(response.error);
      setNewProfile({ firstName: '', lastName: '' });
      toast(`Created ${response.profile.slackUserId}.`);
    });

  const visibleChannel = channel.filter((item) => item.slackUserId === author);
  const authorLabel = (slackUserId: string) =>
    authors.find((entry) => entry.slackUserId === slackUserId)?.label ?? slackUserId;

  return (
    <>
      <header className="sandbox-header">
        <div>
          <h1>Local Sandbox</h1>
          <p>
            Compose Sandbox Messages on behalf of an Author. Each one enters the same intake a Slack
            message would and is processed in this process. Nothing here contacts Slack.
          </p>
        </div>
        <nav aria-label="App pages">
          <Link href="/today">Week</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/profile">Profile</Link>
        </nav>
      </header>

      <div className="sandbox-grid">
        <div className="sandbox-column">
          <section className="sandbox-card" aria-labelledby="compose-heading">
            <h2 id="compose-heading">Compose</h2>
            <p>
              The Author is who the Declaration belongs to. It is independent of who is signed in.
            </p>
            <div className="sandbox-field">
              <label htmlFor="sandbox-author">Author</label>
              <select
                id="sandbox-author"
                value={author}
                onChange={(event) => {
                  setAuthor(event.target.value);
                  setEditing(null);
                }}
              >
                {authors.map((entry) => (
                  <option key={entry.slackUserId} value={entry.slackUserId}>
                    {entry.label} · {entry.slackUserId}
                  </option>
                ))}
              </select>
            </div>
            <div className="sandbox-chips" aria-label="Sample messages">
              {samples.map((sample) => (
                <button key={sample.label} type="button" onClick={() => setText(sample.text)}>
                  {sample.label}
                </button>
              ))}
            </div>
            <div className="sandbox-field">
              <label htmlFor="sandbox-text">Message</label>
              <textarea
                id="sandbox-text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="wfh today, in at 10 tomorrow"
              />
            </div>
            <div className="sandbox-field">
              <label htmlFor="sandbox-announced">Announced at (Europe/Copenhagen, optional)</label>
              <input
                id="sandbox-announced"
                type="datetime-local"
                value={announcedAt}
                onChange={(event) => setAnnouncedAt(event.target.value)}
              />
              <small>
                Defaults to now. A backdated message also backdates its Declaration&apos;s
                announcement, so today&apos;s Resolved Status ignores it as a declaration for today;
                look at the announced day instead.
              </small>
            </div>
            <div className="sandbox-row">
              <button className="sandbox-button" type="button" onClick={send} disabled={pending}>
                Send as {authorLabel(author)}
              </button>
              {announcedAt && (
                <button className="sandbox-inline" type="button" onClick={() => setAnnouncedAt('')}>
                  Use now
                </button>
              )}
            </div>
            {error && (
              <p className="sandbox-error" role="alert">
                {error}
              </p>
            )}
            {outcome && <Outcome outcome={outcome} />}
          </section>

          <section className="sandbox-card" aria-labelledby="channel-heading">
            <h2 id="channel-heading">Channel · {authorLabel(author)}</h2>
            <p>
              Messages you typed for this Author, kept in this browser only. Edits and deletions
              send real <code>message_changed</code> and <code>message_deleted</code> events.
            </p>
            {visibleChannel.length === 0 ? (
              <p className="sandbox-hint">Nothing sent as this Author yet.</p>
            ) : (
              <ul className="sandbox-list">
                {visibleChannel.map((item) => (
                  <li key={item.messageTs} className="sandbox-message">
                    <header>
                      <span>{wallClock(item.announcedAt)}</span>
                      <span>{item.lastOutcome}</span>
                    </header>
                    {editing?.messageTs === item.messageTs ? (
                      <>
                        <textarea
                          aria-label="Edited message"
                          value={editing.text}
                          onChange={(event) =>
                            setEditing({ messageTs: item.messageTs, text: event.target.value })
                          }
                        />
                        <div className="sandbox-row">
                          <button
                            className="sandbox-button"
                            type="button"
                            onClick={() => saveEdit(item)}
                            disabled={pending}
                          >
                            Save edit
                          </button>
                          <button
                            className="sandbox-button secondary"
                            type="button"
                            onClick={() => setEditing(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p>{item.text}</p>
                        <div className="sandbox-row">
                          <button
                            type="button"
                            onClick={() =>
                              setEditing({ messageTs: item.messageTs, text: item.text })
                            }
                          >
                            Edit
                          </button>
                          <button type="button" onClick={() => remove(item)} disabled={pending}>
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {channel.length > 0 && (
              <div className="sandbox-row" style={{ marginTop: 12 }}>
                <button
                  className="sandbox-button secondary"
                  type="button"
                  onClick={() => saveChannel([])}
                >
                  Clear list
                </button>
                <span className="sandbox-hint">
                  Clears this browser list only; Declarations already applied stay.
                </span>
              </div>
            )}
          </section>

          <section className="sandbox-card" aria-labelledby="inbox-heading">
            <h2 id="inbox-heading">Inbox</h2>
            <p>
              The <code>slack_messages</code> rows of the sandbox workspace. This is the truth; text
              is cleared on every terminal outcome by design.
            </p>
            <div className="sandbox-row" style={{ marginBottom: 10 }}>
              <button
                className="sandbox-button secondary"
                type="button"
                onClick={retries}
                disabled={pending}
              >
                Run due retries
              </button>
              <span className="sandbox-hint">
                Pending rows retry with backoff. Without Supabase, the dashboard notices changes on
                its next poll, up to 15 seconds later.
              </span>
            </div>
            {overview.inbox.length === 0 ? (
              <p className="sandbox-hint">No inbox rows.</p>
            ) : (
              <table className="sandbox-table">
                <thead>
                  <tr>
                    <th>Announced</th>
                    <th>Author</th>
                    <th>State</th>
                    <th>Reason</th>
                    <th>Attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.inbox.map((row) => (
                    <tr key={row.messageKey}>
                      <td>{wallClockOfTs(row.messageTs)}</td>
                      <td>{row.slackUserId ? authorLabel(row.slackUserId) : '–'}</td>
                      <td>
                        <span className={`sandbox-badge ${row.state}`}>{row.state}</span>
                      </td>
                      <td>{row.reason ?? '–'}</td>
                      <td>{row.attempts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <div className="sandbox-column">
          <section className="sandbox-card" aria-labelledby="readiness-heading">
            <h2 id="readiness-heading">Readiness</h2>
            <ul className="sandbox-checks">
              {overview.readiness.checks.map((check) => (
                <li key={check.name}>
                  <span className={check.ok ? 'sandbox-ok' : 'sandbox-bad'} aria-hidden="true">
                    {check.ok ? '✓' : '✗'}
                  </span>
                  <span>
                    <code>{check.name}</code>
                    {check.ok ? '' : ` — ${check.hint}`}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="sandbox-card" aria-labelledby="signed-in-heading">
            <h2 id="signed-in-heading">Signed-in Profile</h2>
            <p>
              Whose <Link href="/profile">/profile</Link> and manual status form the browser shows.
              Independent of Author.
            </p>
            {overview.signedIn ? (
              <div className="sandbox-row">
                <strong>{profileName(overview.signedIn)}</strong>
                {overview.signedIn.sandbox ? (
                  <span className="sandbox-badge">sandbox session</span>
                ) : (
                  <span className="sandbox-badge">real Slack session</span>
                )}
                <form action={signOutSandboxAction}>
                  <button className="sandbox-inline" type="submit">
                    Sign out
                  </button>
                </form>
              </div>
            ) : (
              <p className="sandbox-hint">Not signed in.</p>
            )}
            <form
              action={signInAsSandboxProfileAction}
              className="sandbox-row"
              style={{ marginTop: 10 }}
            >
              <label htmlFor="sandbox-sign-in" className="sr-only">
                Sign in as
              </label>
              <select id="sandbox-sign-in" name="userId" defaultValue={activeProfiles[0]?.userId}>
                {activeProfiles.map((profile) => (
                  <option key={profile.userId} value={profile.userId}>
                    {profileName(profile)}
                  </option>
                ))}
              </select>
              <button
                className="sandbox-button"
                type="submit"
                disabled={activeProfiles.length === 0}
              >
                Sign in as
              </button>
            </form>
          </section>

          <section className="sandbox-card" aria-labelledby="profiles-heading">
            <h2 id="profiles-heading">Sandbox Profiles</h2>
            <p>People who exist only in this local database, under team {`T_LOCAL`}.</p>
            {overview.profiles.length === 0 ? (
              <p className="sandbox-hint">
                No profiles yet. Seed the fixtures or run <code>pnpm sandbox:seed</code>.
              </p>
            ) : (
              <ul className="sandbox-profiles">
                {overview.profiles.map((profile) => (
                  <li key={profile.userId}>
                    <span>
                      {profileName(profile)}
                      {profile.slackDeactivated && (
                        <>
                          {' '}
                          <span className="sandbox-badge">deactivated</span>
                        </>
                      )}
                    </span>
                    <span>{profile.slackUserId}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="sandbox-row" style={{ marginTop: 12 }}>
              <button
                className="sandbox-button secondary"
                type="button"
                onClick={seed}
                disabled={pending}
              >
                Seed fixture profiles
              </button>
            </div>
            <h3>Add a profile</h3>
            <div className="sandbox-row">
              <input
                aria-label="First name"
                placeholder="First name"
                value={newProfile.firstName}
                onChange={(event) =>
                  setNewProfile({ ...newProfile, firstName: event.target.value })
                }
                style={{ flex: 1 }}
              />
              <input
                aria-label="Last name"
                placeholder="Last name"
                value={newProfile.lastName}
                onChange={(event) => setNewProfile({ ...newProfile, lastName: event.target.value })}
                style={{ flex: 1 }}
              />
              <button
                className="sandbox-button secondary"
                type="button"
                onClick={addProfile}
                disabled={pending || !newProfile.firstName.trim()}
              >
                Add
              </button>
            </div>
          </section>

          <section className="sandbox-card" aria-labelledby="reset-heading">
            <h2 id="reset-heading">Reset</h2>
            <p>
              Deletes every Declaration and inbox row belonging to the sandbox workspace and clears
              the browser list. Profiles are kept; seed again to restore fixture Declarations.
            </p>
            <button
              className="sandbox-button danger"
              type="button"
              onClick={reset}
              disabled={pending}
            >
              Reset sandbox data
            </button>
          </section>
        </div>
      </div>
    </>
  );
}

function Outcome({ outcome }: { outcome: SandboxOutcome }) {
  const { processing, interpretation } = outcome;
  return (
    <div className="sandbox-outcome" aria-live="polite">
      <h3>Result</h3>
      <dl>
        <dt>Intake</dt>
        <dd>
          {outcome.intake.outcome}
          {outcome.intake.reason ? ` · ${outcome.intake.reason}` : ''}
        </dd>
        <dt>Processing</dt>
        <dd>
          {processing.kind === 'terminal' &&
            `${processing.state}${processing.reason ? ` · ${processing.reason}` : ''} after ${processing.attempts} attempt${processing.attempts === 1 ? '' : 's'}`}
          {processing.kind === 'retry_scheduled' &&
            `Retry scheduled in ${processing.afterSeconds}s (attempt ${processing.attempts}). Likely reason: ${processing.likelyReason}. This is a normal inbox outcome.`}
          {processing.kind === 'not_processed' && 'Not processed'}
        </dd>
        <dt>Handled by</dt>
        <dd>
          {outcome.handledBy === 'shorthand' && 'Deterministic shorthand parser, no model call'}
          {outcome.handledBy === 'model' && 'AI Gateway model'}
          {outcome.handledBy === null && '–'}
        </dd>
        <dt>Announced</dt>
        <dd>
          {wallClock(outcome.announcedAt)}
          {outcome.backdated ? ' · not today, so today’s Resolved Status ignores it' : ''}
        </dd>
        <dt>Key</dt>
        <dd>
          <code>{outcome.messageKey}</code>
        </dd>
      </dl>
      {interpretation && (
        <>
          <h3>
            Interpretation · {interpretation.decision}
            {interpretation.reason ? ` · ${interpretation.reason}` : ''}
          </h3>
          {interpretation.intervals.length === 0 ? (
            <p className="sandbox-hint">No intervals were committed.</p>
          ) : (
            <table className="sandbox-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>≈Start</th>
                  <th>≈End</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {interpretation.intervals.map((interval, index) => (
                  <tr key={index}>
                    <td>{interval.status ?? 'description only'}</td>
                    <td>{interval.fromDate}</td>
                    <td>{interval.toDate}</td>
                    <td>{interval.startTime ?? '–'}</td>
                    <td>{interval.endTime ?? '–'}</td>
                    <td>{interval.startApproximate ? 'yes' : 'no'}</td>
                    <td>{interval.endApproximate ? 'yes' : 'no'}</td>
                    <td>{interval.details ?? '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="sandbox-hint">
            Reconstructed from the committed rows: the inbox stores the intervals it applied and the
            decision reason, not the raw model output.
          </p>
        </>
      )}
    </div>
  );
}
