import Credentials from 'next-auth/providers/credentials';
import type { Account, User } from 'next-auth';
import type { Provider } from 'next-auth/providers';
import type { JWT } from 'next-auth/jwt';
import { isSandbox, SANDBOX_TEAM_ID } from './enabled';

export const SANDBOX_PROVIDER_ID = 'sandbox';

/**
 * Signs a browser in as a Sandbox Profile. Registered only outside production builds;
 * see docs/adr/0002-sandbox-auth-masquerades-as-slack-provider.md.
 */
export function sandboxProviders(): Provider[] {
  if (!isSandbox()) return [];
  return [
    Credentials({
      id: SANDBOX_PROVIDER_ID,
      name: 'Local Sandbox',
      credentials: { userId: { label: 'Sandbox Profile' } },
      async authorize(credentials) {
        if (!isSandbox()) return null;
        const userId = typeof credentials?.userId === 'string' ? credentials.userId : '';
        if (!userId) return null;
        const { db } = await import('@/db');
        const { users } = await import('@/db/schema');
        const { and, eq } = await import('drizzle-orm');
        const [profile] = await db
          .select({ id: users.userId })
          .from(users)
          .where(
            and(
              eq(users.userId, userId),
              eq(users.slackTeamId, SANDBOX_TEAM_ID),
              eq(users.slackDeactivated, false)
            )
          )
          .limit(1);
        return profile ? { id: profile.id } : null;
      },
    }),
  ];
}

/**
 * Downstream code authorizes on the literal provider name `slack`. A sandbox sign-in
 * claims that name so no production predicate needs a sandbox branch; `token.sandbox`
 * records the truth for display only and must never drive an authorization decision.
 */
export function applySandboxSignIn(token: JWT, account: Account | null | undefined, user?: User) {
  if (!isSandbox() || account?.provider !== SANDBOX_PROVIDER_ID || !user?.id) return token;
  token.provider = 'slack';
  token.sub = user.id;
  token.userId = user.id;
  token.sandbox = true;
  return token;
}
