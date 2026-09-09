import Slack from 'next-auth/providers/slack';
import type { NextAuthConfig } from 'next-auth';
export const authConfig = {
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  providers: [
    {
      ...Slack({
        clientId: process.env.AUTH_SLACK_ID!,
        clientSecret: process.env.AUTH_SLACK_SECRET!,
      }),
      type: 'oidc',
      // Validate the ID token and also call userInfo for the user's current photo.
      idToken: false,
      authorization: { params: { scope: 'openid profile email', team: process.env.SLACK_TEAM_ID } },
    },
  ],
  session: { maxAge: 8 * 60 * 60 },
  callbacks: {
    async authorized({ auth }) {
      return auth?.provider === 'slack' && Boolean(auth.userId);
    },
    async jwt({ token, account }) {
      if (account) token.provider = account.provider;
      return token;
    },
    async session({ session, token }) {
      return token.provider === 'slack'
        ? { ...session, userId: token.userId ?? token.sub, provider: 'slack' }
        : { ...session, userId: undefined, provider: undefined };
    },
  },
} satisfies NextAuthConfig;
