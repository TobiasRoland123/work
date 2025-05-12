import NextAuth from 'next-auth';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
      issuer: `https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID}/v2.0`,
      authorization: {
        params: {
          scope: 'openid profile email User.Read User.Read.All',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account?.access_token) {
        token.access_token = account.access_token;
      }
      return token;
    },
    async authorized({ auth }) {
      // Basic implementation - customize based on your requirements
      return !!auth; // Only allows authenticated users
    },

    async session({ session, token }) {
      return {
        ...session,
        accessToken: token.access_token as string,
      };
    },
  },
  secret: process.env.AUTH_SECRET,
  trustHost: true, // Add this line to trust localhost during development
});
