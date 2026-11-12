import type { ReactNode } from 'react';
import type { listSandboxEchoes } from '@/lib/services/echoService';
import { ECHO_CHANNEL_LABEL } from '@/lib/status/echo';
import { formatDay } from '@/lib/status/week';

type Echoes = Awaited<ReturnType<typeof listSandboxEchoes>>;

const postedAt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Copenhagen',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const unescape = (text: string) =>
  text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** The bits of Slack mrkdwn an Echo uses: ~strike~ and *bold*, nested either way. */
function inline(text: string, key = 'm'): ReactNode[] {
  return text
    .split(/(~[^~\n]+~|\*[^*\n]+\*)/)
    .filter(Boolean)
    .map((part, index) => {
      const id = `${key}-${index}`;
      if (part.length > 2 && part.startsWith('~') && part.endsWith('~'))
        return <s key={id}>{inline(part.slice(1, -1), id)}</s>;
      if (part.length > 2 && part.startsWith('*') && part.endsWith('*'))
        return <strong key={id}>{inline(part.slice(1, -1), id)}</strong>;
      return <span key={id}>{unescape(part)}</span>;
    });
}

function EchoText({ text }: { text: string }) {
  const lines = text.split('\n');
  const quote = lines.filter((line) => line.startsWith('>'));
  return (
    <div className="sandbox-echo-text">
      <p>{inline(lines[0])}</p>
      {quote.length > 0 && (
        <blockquote>
          {quote.map((line, index) => (
            <p key={index}>{inline(line.replace(/^> ?/, ''), `q${index}`)}</p>
          ))}
        </blockquote>
      )}
    </div>
  );
}

const initials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

/** Sandbox Echoes laid out like the attendance channel, under each person's name and photo. */
export function SandboxEchoes({
  echoes,
  pending,
  onPostNow,
}: {
  echoes: Echoes;
  pending: boolean;
  onPostNow: () => void;
}) {
  const next = echoes.waiting[0];
  return (
    <section className="sandbox-card" aria-labelledby="echoes-heading">
      <h2 id="echoes-heading">Sandbox Echoes · {ECHO_CHANNEL_LABEL}</h2>
      <p>
        What the WORK 2.0 bot would post for statuses people set about themselves in the app.
        Nothing here contacts Slack. Echoes post at 08:00 on their day, or at once when saved later
        that day.
      </p>
      <div className="sandbox-row" style={{ marginBottom: 10 }}>
        <button className="sandbox-button" type="button" onClick={onPostNow} disabled={pending}>
          Post today&rsquo;s Echoes now
        </button>
        <span className="sandbox-hint">
          {echoes.waiting.length === 0
            ? 'No Echoes waiting.'
            : `${echoes.waiting.length} waiting; next for ${next.name} on ${formatDay(next.postOn, {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}.`}
        </span>
      </div>
      {echoes.posted.length === 0 ? (
        <p className="sandbox-hint">No Echoes posted yet.</p>
      ) : (
        <ol className="sandbox-echoes">
          {echoes.posted.map((echo) => (
            <li key={echo.id} className="sandbox-echo">
              {echo.profilePicture ? (
                // Slack-hosted photos load directly, as everywhere else in Wørk.
                // eslint-disable-next-line @next/next/no-img-element
                <img className="sandbox-echo-avatar" src={echo.profilePicture} alt="" />
              ) : (
                <span className="sandbox-echo-avatar" aria-hidden="true">
                  {initials(echo.name)}
                </span>
              )}
              <div>
                <header>
                  <strong>{echo.name}</strong>
                  <span className="sandbox-badge">APP</span>
                  <time dateTime={echo.postedAt}>{postedAt.format(new Date(echo.postedAt))}</time>
                </header>
                <EchoText text={echo.text} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
