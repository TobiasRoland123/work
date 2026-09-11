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
      className="mx-auto my-5 max-w-[920px] rounded-md border border-[#deded9] bg-[#fff8e5] px-5 py-4 text-[#0b1014] sm:px-7"
      aria-labelledby="slack-review-heading"
    >
      <h2 id="slack-review-heading" className="font-mono text-xl">
        Check your attendance
      </h2>
      <p className="mt-2 max-w-[70ch] text-sm leading-6 text-[#55543c]">
        Some Slack messages could not be applied reliably. Set your status in Wørk or edit the
        original message with a clear date and time.
      </p>
      <ul className="mt-3 list-disc pl-5 text-sm">
        {rows.map((row) => (
          <li key={row.key}>
            <a
              className="text-[#2d6ea8] underline hover:text-[#0b1014]"
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
