import { and, eq, isNotNull, ne } from 'drizzle-orm';
import { db, pool } from '../db';
import { users } from '../db/schema';

async function main() {
  const [action, userId, extra] = process.argv.slice(2);
  if ((action !== 'grant' && action !== 'revoke') || !userId || extra || userId.length > 36) {
    throw new Error('Usage: pnpm message-review:access grant|revoke <exact-user-id>');
  }

  const teamId = process.env.SLACK_TEAM_ID;
  if (!teamId) throw new Error('SLACK_TEAM_ID must name the intended workspace');

  const eligible = and(
    eq(users.userId, userId),
    eq(users.slackTeamId, teamId),
    eq(users.slackDeactivated, false),
    isNotNull(users.slackUserId),
    ne(users.slackUserId, '')
  );

  const [changed] = await db
    .update(users)
    .set({ canReviewMessages: action === 'grant' })
    .where(action === 'grant' ? eligible : eq(users.userId, userId))
    .returning({ userId: users.userId });
  if (!changed) {
    throw new Error(
      action === 'grant'
        ? 'No active Slack member with that exact user ID exists in the configured workspace'
        : 'No user with that exact user ID exists'
    );
  }

  const [readback] = await db
    .select({
      userId: users.userId,
      email: users.email,
      slackTeamId: users.slackTeamId,
      slackDeactivated: users.slackDeactivated,
      canReviewMessages: users.canReviewMessages,
    })
    .from(users)
    .where(eq(users.userId, userId))
    .limit(1);

  if (!readback || readback.canReviewMessages !== (action === 'grant')) {
    throw new Error('Permission update could not be verified');
  }
  console.info(JSON.stringify(readback, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Permission update failed');
    process.exitCode = 1;
  })
  .finally(() => pool.end());
