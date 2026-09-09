import dotenv from 'dotenv';
import { and, eq, notInArray, inArray } from 'drizzle-orm';
import { db } from '../db';
import { organisations, users } from '../db/schema';
import {
  listSlackUsers,
  validateSlackBotTeam,
  SlackUser,
  isActiveSlackMember,
  getSlackTeamId,
} from '../lib/slack/client';
import { resolveSlackUser } from '../lib/slack/identity';
import path from 'node:path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export async function syncSlackUsers(slackUsers: SlackUser[] = []) {
  await validateSlackBotTeam();
  if (slackUsers.length === 0) slackUsers = await listSlackUsers();
  const activeIds = slackUsers.filter(isActiveSlackMember).map((user) => user.id);
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ slackDeactivated: true })
      .where(
        and(
          eq(users.slackTeamId, getSlackTeamId()),
          ...(activeIds.length ? [notInArray(users.slackUserId, activeIds)] : [])
        )
      );
    if (activeIds.length)
      await tx
        .update(users)
        .set({ slackDeactivated: false })
        .where(and(eq(users.slackTeamId, getSlackTeamId()), inArray(users.slackUserId, activeIds)));
  });
  const [organisation] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.organisationName, 'Charlie Tango'))
    .limit(1);
  const organisationId = organisation?.id;
  const results: {
    synced: string[];
    skipped: { id: string; reason: string }[];
  } = { synced: [], skipped: [] };
  for (const slackUser of slackUsers) {
    if (!isActiveSlackMember(slackUser)) continue;
    try {
      const profile = slackUser.profile ?? {};
      const email = typeof profile.email === 'string' ? profile.email.trim().toLowerCase() : '';
      const current = await resolveSlackUser(slackUser);
      const firstName =
        profile.first_name ||
        profile.real_name?.split(/\s+/)[0] ||
        slackUser.real_name?.split(/\s+/)[0] ||
        null;
      const lastName =
        profile.last_name || profile.real_name?.split(/\s+/).slice(1).join(' ') || null;
      const update: Record<string, unknown> = {
        firstName,
        lastName,
        email,
        slackUserId: slackUser.id,
        slackTeamId: current.slackTeamId,
      };
      if (profile.phone) update.mobilePhone = profile.phone.replaceAll(' ', '');
      if (organisationId && !current.organisationId) update.organisationId = organisationId;
      await db.update(users).set(update).where(eq(users.userId, current.userId));
      results.synced.push(current.userId);
    } catch (error) {
      results.skipped.push({
        id: slackUser.id,
        reason: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  return results;
}

export async function seedSlackUsers() {
  return syncSlackUsers();
}

if (process.argv[1]?.endsWith('scripts/seed.ts')) {
  seedSlackUsers()
    .then((result) => {
      console.info(JSON.stringify(result));
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
