import NextAuth from 'next-auth';
import authConfig from './auth.config';
import { resolveSlackLogin } from '@/lib/slack/directory';

export const {
  auth,
  handlers, // Export the default handlers directly
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ account, profile }) {
      if (account?.provider !== 'slack' || !profile) return false;
      return Boolean(await resolveSlackLogin(profile as { [key: string]: unknown }));
    },
    async jwt({ token, account, profile }) {
      delete token.access_token;
      delete token.id;
      if (account?.provider === 'slack' && profile) {
        const userId = await resolveSlackLogin(profile as { [key: string]: unknown });
        if (!userId) return {};
        token.userId = userId;
      }
      return token;
    },
    async session({ session, token }) {
      const userId = typeof token.userId === 'string' ? token.userId : undefined;
      if (!userId) return {} as typeof session;
      return {
        ...session,
        userId,
      };
    },
  },
});
