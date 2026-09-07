import { randomUUID } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { slackIdentities, users } from '@/db/schema';
import { isWorkspaceMember, SlackClient, SlackUser, SLACK_TEAM_ID } from './client';

export function profileImage(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      ['avatars.slack-edge.com', 'secure.gravatar.com', 'a.slack-edge.com'].includes(url.hostname) ? url.href : null;
  } catch { return null; }
}

export function memberProfile(member: SlackUser) {
  const p = member.profile;
  const name = (p.real_name || p.display_name || '').trim().split(/\s+/);
  return {
    firstName: (p.first_name || name[0] || '').slice(0, 60),
    lastName: (p.last_name || name.slice(1).join(' ')).slice(0, 255),
    profilePicture: profileImage(p.image_512 || p.image_192),
  };
}

export async function syncDirectory(client = new SlackClient()) {
  await client.verifyWorkspace();
  const snapshot = await client.listUsers();
  const members = snapshot.filter(isWorkspaceMember);
  const emails = members.map(m => m.profile.email?.trim().toLowerCase()).filter(Boolean);
  if (new Set(emails).size !== emails.length) throw new Error('Slack directory has ambiguous email identities');
  const result = await db.transaction(async tx => {
    const active: string[] = [];
    let created = 0;
    for (const member of members) {
      const [identity] = await tx.select().from(slackIdentities).where(and(eq(slackIdentities.teamId, SLACK_TEAM_ID), eq(slackIdentities.slackUserId, member.id)));
      let userId = identity?.userId;
      const email = member.profile.email?.trim().toLowerCase();
      if (!userId) {
        // Only the authenticated bot directory may perform the one-time email match.
        // Login claims alone can never link accounts or change a primary key.
        if (!email || email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
        const matches = await tx.select().from(users).where(sql`lower(trim(${users.email})) = ${email}`);
        if (matches.length > 1) throw new Error('Existing directory has ambiguous email identities');
        userId = matches[0]?.userId;
        if (userId) {
          const [linked] = await tx.select().from(slackIdentities).where(eq(slackIdentities.userId, userId));
          if (linked) throw new Error('Existing user already has a different Slack identity');
        } else {
          userId = randomUUID();
          await tx.insert(users).values({ userId, email, ...memberProfile(member) });
          created++;
        }
        await tx.insert(slackIdentities).values({ teamId: SLACK_TEAM_ID, slackUserId: member.id, userId, active: true });
      }
      // Email changes never move an identity to a different app account.
      await tx.update(users).set(memberProfile(member)).where(eq(users.userId, userId));
      active.push(member.id);
    }
    await tx.update(slackIdentities).set({ active: false }).where(eq(slackIdentities.teamId, SLACK_TEAM_ID));
    if (active.length) await tx.update(slackIdentities).set({ active: true }).where(and(eq(slackIdentities.teamId, SLACK_TEAM_ID), inArray(slackIdentities.slackUserId, active)));
    return { active: active.length, created };
  });
  return result;
}

export async function resolveSlackLogin(profile: { [key: string]: unknown }): Promise<string | null> {
  const id = profile['https://slack.com/user_id'];
  if (profile['https://slack.com/team_id'] !== SLACK_TEAM_ID || profile.email_verified !== true || typeof id !== 'string' || !/^[UW][A-Z0-9]+$/.test(id)) return null;
  const client = new SlackClient();
  await client.verifyWorkspace();
  if (!isWorkspaceMember(await client.getUser(id))) return null;
  const [identity] = await db.select().from(slackIdentities).where(and(eq(slackIdentities.teamId, SLACK_TEAM_ID), eq(slackIdentities.slackUserId, id), eq(slackIdentities.active, true)));
  return identity?.userId ?? null;
}
