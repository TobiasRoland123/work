import { db } from '@/db';
import { slackMessages, status, users } from '@/db/schema';
import type { Status } from '@/db/types';
import { and, eq, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

/** Load source authors once per result set; only a display name reaches the client. */
export async function withStatusAttribution(rows: Status[]): Promise<Status[]> {
  const importedIds = rows.filter((row) => row.sourceMessageKey).map((row) => row.id);
  if (!importedIds.length) return rows;
  const author = alias(users, 'announcement_author');
  const sources = await db
    .select({
      statusId: status.id,
      sourceTeam: slackMessages.teamId,
      sourceSlackId: slackMessages.slackUserId,
      recipientTeam: users.slackTeamId,
      recipientSlackId: users.slackUserId,
      firstName: author.firstName,
      lastName: author.lastName,
    })
    .from(status)
    .innerJoin(slackMessages, eq(status.sourceMessageKey, slackMessages.messageKey))
    .innerJoin(users, eq(status.userID, users.userId))
    .leftJoin(
      author,
      and(
        eq(author.slackTeamId, slackMessages.teamId),
        eq(author.slackUserId, slackMessages.slackUserId)
      )
    )
    .where(inArray(status.id, importedIds));
  const authors = new Map(
    sources
      .filter(
        (source) =>
          source.sourceSlackId &&
          !(
            source.sourceTeam === source.recipientTeam &&
            source.sourceSlackId === source.recipientSlackId
          )
      )
      .map((source) => [
        source.statusId,
        {
          name: [source.firstName, source.lastName].filter(Boolean).join(' ').trim() || null,
        },
      ])
  );
  return rows.map((row) => {
    const sourceAuthor = authors.get(row.id);
    return sourceAuthor ? { ...row, sourceAuthor } : row;
  });
}
