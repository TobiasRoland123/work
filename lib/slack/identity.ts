import { getSlackImageUrl } from './image';
import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { getSlackTeamId, SlackUser } from './client';
export class SlackIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SlackIdentityError';
  }
}
export type TrustedSlackIdentity = {
  slackUserId: string;
  slackTeamId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  profilePicture?: string | null;
};
export function validateIdentityMapping(
  identity: TrustedSlackIdentity,
  bySlack: Array<{
    userId: string;
    email: string;
    slackUserId?: string | null;
    slackTeamId?: string | null;
  }>,
  byEmail: Array<{
    userId: string;
    email: string;
    slackUserId?: string | null;
    slackTeamId?: string | null;
  }>
) {
  if (byEmail.length > 1) throw new SlackIdentityError('Ambiguous existing user email mapping');
  if (bySlack.length > 1) throw new SlackIdentityError('Ambiguous existing Slack identity mapping');
  if (bySlack[0] && byEmail[0] && bySlack[0].userId !== byEmail[0].userId)
    throw new SlackIdentityError('Slack identity and email map to different users');
  if (bySlack[0] && normalizeSlackEmail(bySlack[0].email) !== identity.email)
    throw new SlackIdentityError('Slack identity is linked to a different email');
  if (
    byEmail[0]?.slackUserId &&
    (byEmail[0].slackUserId !== identity.slackUserId ||
      byEmail[0].slackTeamId !== identity.slackTeamId)
  )
    throw new SlackIdentityError('User is already linked to a different Slack account');
  return bySlack[0] ?? byEmail[0] ?? null;
}
export function normalizeSlackEmail(email: unknown): string {
  if (typeof email !== 'string' || !email.trim())
    throw new SlackIdentityError('Slack account has no email');
  return email.trim().toLowerCase();
}
export function validateSlackProfile(profile: Record<string, unknown>): TrustedSlackIdentity {
  const email = normalizeSlackEmail(profile.email);
  if (profile.email_verified !== true) throw new SlackIdentityError('Slack email is not verified');
  const slackUserId =
    typeof profile.sub === 'string'
      ? profile.sub
      : typeof profile['https://slack.com/user_id'] === 'string'
        ? (profile['https://slack.com/user_id'] as string)
        : '';
  const slackTeamId =
    typeof profile['https://slack.com/team_id'] === 'string'
      ? (profile['https://slack.com/team_id'] as string)
      : typeof profile.team_id === 'string'
        ? profile.team_id
        : '';
  if (!slackUserId || !slackTeamId || slackTeamId !== getSlackTeamId())
    throw new SlackIdentityError('Slack account is outside the configured workspace');
  return {
    slackUserId,
    slackTeamId,
    email,
    firstName:
      (typeof profile.given_name === 'string' && profile.given_name) ||
      (typeof profile.name === 'string' ? profile.name.split(/\s+/)[0] : null),
    lastName: typeof profile.family_name === 'string' ? profile.family_name : null,
    profilePicture: typeof profile.picture === 'string' ? profile.picture : null,
  };
}
export async function resolveSlackIdentity(identity: TrustedSlackIdentity) {
  return db.transaction(async (tx) => {
    // Lock both lookup keys independently in deterministic order. Two Slack
    // accounts racing to claim one old email must not overwrite each other.
    for (const key of [
      `email:${identity.email}`,
      `slack:${identity.slackTeamId}:${identity.slackUserId}`,
    ].sort()) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
    }
    const bySlack = await tx
      .select()
      .from(users)
      .where(
        and(
          eq(users.slackUserId, identity.slackUserId),
          eq(users.slackTeamId, identity.slackTeamId)
        )
      );
    const byEmail = await tx
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${identity.email}`);
    const user = validateIdentityMapping(identity, bySlack, byEmail);
    if (bySlack[0]?.slackDeactivated || byEmail[0]?.slackDeactivated)
      throw new SlackIdentityError('Slack account is inactive');
    const profile = {
      ...(identity.firstName ? { firstName: identity.firstName } : {}),
      ...(identity.lastName ? { lastName: identity.lastName } : {}),
      profilePicture: getSlackImageUrl(identity.profilePicture),
      slackUserId: identity.slackUserId,
      slackTeamId: identity.slackTeamId,
      email: identity.email,
    };
    if (user) {
      const [updated] = await tx
        .update(users)
        .set(profile)
        .where(eq(users.userId, user.userId))
        .returning();
      return updated;
    }
    const [created] = await tx
      .insert(users)
      .values({ userId: randomUUID(), ...profile })
      .returning();
    return created;
  });
}
export async function resolveSlackUser(user: SlackUser) {
  const profile = user.profile ?? {};
  const email = normalizeSlackEmail(profile.email);
  const teamId = user.team_id ?? getSlackTeamId();
  if (teamId !== getSlackTeamId())
    throw new SlackIdentityError(`Slack user ${user.id} is outside the configured workspace`);
  return resolveSlackIdentity({
    slackUserId: user.id,
    slackTeamId: teamId,
    email,
    firstName: profile.first_name ?? null,
    lastName: profile.last_name ?? null,
    profilePicture: profile.image_512 ?? null,
  });
}
