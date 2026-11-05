---
status: accepted
---

# Deploys apply migrations from a recorded baseline

Production code twice shipped ahead of its schema (`pinned_colleagues`, `status_supersessions`), and pages failed until someone applied the missing SQL by hand. Vercel builds now run `pnpm db:deploy-migrate` before `next build`. The runner applies migrations newer than the database's Drizzle ledger, one transaction each, under an advisory lock.

## Considered options

Running drizzle-orm's `migrate()` directly was rejected. It treats an empty ledger as a blank database and replays every migration from `0000`, which is an introspection baseline that cannot apply to production. Production has no Drizzle ledger. It also applies all pending migrations in one transaction, so one failure discards the ones that succeeded.

Inferring applied migrations from the schema was rejected: there is no general test for whether arbitrary SQL has run.

Running migrations at application start was rejected: every cold start would contend for the lock, and a failure would take the site down instead of failing a build.

## Consequences

A person must record each unjournaled database's baseline once with `pnpm db:baseline`. Until then, production builds fail and the previous deployment keeps serving. The ledger uses Drizzle's table and hashes, so `drizzle-orm`'s own tooling agrees with it afterwards.

Previews do not migrate unless `DEPLOY_MIGRATIONS_PREVIEW=1`, because a preview's database may be production's. Migrations run before new code is live, so they must be compatible with the code that is still serving.
