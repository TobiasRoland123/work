---
status: accepted
---

# The sandbox credentials provider reports itself as the Slack provider

Five separate predicates authorize requests by testing for the literal provider name
`slack`: `middleware.ts`, `authorized` and `session` in `auth.config.ts`, the `jwt` and
`session` callbacks in `auth.ts`, and `requireUserId` in `lib/auth/require-user.ts`. The
Local Sandbox signs in through a NextAuth credentials provider with id `sandbox`, which
is registered only outside production builds; a guarded branch in the `auth.ts` `jwt`
callback then sets `token.provider = 'slack'` and `token.userId`. Downstream code cannot
distinguish a sandbox session from a real one, which is the point.

## Considered options

Widening all five predicates to also accept `sandbox` was rejected. It is not less
secure — minting a token with any provider claim requires `AUTH_SECRET`, and anyone
holding that could simply claim `slack` — but it puts five load-bearing `||` clauses
into production files where a future reader has no way to tell they matter. Bypassing
NextAuth with a sandbox cookie was rejected because it would skip the per-request
database revalidation at `auth.ts:32-47`, which is what makes a deactivated Sandbox
Profile behave like a deactivated colleague.

## Consequences

A session token will report `provider: 'slack'` on a machine with no Slack configured at
all. A separate `token.sandbox` claim records the truth and is used only for display; no
authorization decision may read it. The whole mechanism rests on the guard being false in
production builds, so a test must assert the provider is not registered when
`NODE_ENV=production`.
