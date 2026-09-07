import Slack from 'next-auth/providers/slack';

/** Configuration shared by edge middleware and server auth handlers. */
const authConfig = {
  providers: [
    Slack({
      clientId: process.env.AUTH_SLACK_ID!,
      clientSecret: process.env.AUTH_SLACK_SECRET!,
      authorization: { params: { scope: 'openid profile email' } },
      checks: ['state', 'nonce'],
    }),
  ],
  callbacks: {
    authorized({ auth, request }) {
      const pathname = request.nextUrl.pathname;
      const publicPath = ['/login', '/api/auth', '/api/check-users', '/api/slack/sync'].some(
        (path) => pathname === path || pathname.startsWith(`${path}/`)
      );
      return publicPath || Boolean(auth?.userId);
    },
  },
  secret: process.env.AUTH_SECRET,
  trustHost: true,
};

export default authConfig;
