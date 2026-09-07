import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { slackMessages, users } from '@/db/schema';

export default async function SlackImportNotice({ userId }: { userId: string }) {
  const rows = await db
    .select({
      key: slackMessages.messageKey,
      channel: slackMessages.channelId,
      ts: slackMessages.messageTs,
    })
    .from(slackMessages)
    .innerJoin(
      users,
      and(
        eq(slackMessages.teamId, users.slackTeamId),
        eq(slackMessages.slackUserId, users.slackUserId)
      )
    )
    .where(and(eq(users.userId, userId), eq(slackMessages.state, 'review')))
    .orderBy(desc(slackMessages.receivedAt))
    .limit(10);
  if (!rows.length) return null;
  return (
    <section
      className="m-4 rounded-md border border-gray-300 p-4"
      aria-labelledby="slack-review-heading"
    >
      <h2 id="slack-review-heading" className="font-mono text-xl">
        Check your attendance
      </h2>
      <p className="mt-2">
        Some Slack messages could not be applied reliably. Set your status in Wørk or edit the
        original message with a clear date and time.
      </p>
      <ul className="mt-2 list-disc pl-5">
        {rows.map((row) => (
          <li key={row.key}>
            <a
              className="underline"
              href={`/api/slack/message?key=${encodeURIComponent(row.key)}`}
              target="_blank"
              rel="noreferrer"
            >
              Open message in Slack
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
