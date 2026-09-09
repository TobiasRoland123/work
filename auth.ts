import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

export const {
  auth,
  handlers, // Export the default handlers directly
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.provider = account.provider;
        if (account.provider === 'slack') {
          const { resolveSlackIdentity, validateSlackProfile } = await import(
            '@/lib/slack/identity'
          );
          const identity = validateSlackProfile((profile ?? {}) as Record<string, unknown>);
          const { validateSlackBotTeam, getSlackUser, isActiveSlackMember } = await import(
            '@/lib/slack/client'
          );
          await validateSlackBotTeam();
          const member = await getSlackUser(identity.slackUserId);
          if (!isActiveSlackMember(member))
            throw new Error('Slack membership does not permit access');
          const user = await resolveSlackIdentity(identity);
          token.sub = user.userId;
          token.userId = user.userId;
        }
      }
      if (token.provider === 'slack' && token.userId) {
        const { db } = await import('@/db');
        const { users } = await import('@/db/schema');
        const { and, eq } = await import('drizzle-orm');
        const [active] = await db
          .select({ id: users.userId })
          .from(users)
          .where(
            and(
              eq(users.userId, token.userId),
              eq(users.slackTeamId, process.env.SLACK_TEAM_ID ?? ''),
              eq(users.slackDeactivated, false)
            )
          )
          .limit(1);
        if (!active) return null;
      }
      return token;
    },
    async session({ session, token }) {
      return token.provider === 'slack'
        ? { ...session, userId: token.userId ?? token.sub, provider: 'slack' }
        : { ...session, userId: undefined, provider: undefined };
    },
  },
  secret: process.env.AUTH_SECRET,
  trustHost: true,
});
