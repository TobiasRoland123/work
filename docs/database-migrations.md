# Database migrations

Vercel builds apply pending migrations before `next build`. `vercel.json` sets the build command to `pnpm db:deploy-migrate && pnpm build`. The runner, `lib/db-migrations/runner.ts`, applies each migration in `db/` that is newer than the database's migration ledger. Each migration runs in its own transaction together with its ledger entry. If a migration fails, it is rolled back, the build fails, and the previous deployment keeps serving. The database stays at the last migration that completed.

The ledger is Drizzle's `drizzle.__drizzle_migrations` table, with the hashes and timestamps Drizzle itself would write. A PostgreSQL advisory lock makes concurrent builds apply migrations one at a time.

## When a build migrates

| Build                                      | Migrates                                |
| ------------------------------------------ | --------------------------------------- |
| Production (`VERCEL_ENV=production`)       | Always                                  |
| Preview (`VERCEL_ENV=preview`)             | Only with `DEPLOY_MIGRATIONS_PREVIEW=1` |
| Vercel development, local `pnpm build`, CI | Never                                   |

A preview builds unmerged code. If previews share production's database, a preview would apply a pull request's migration to production before review. Set `DEPLOY_MIGRATIONS_PREVIEW=1` in Vercel's **Preview** environment only when previews use a database of their own. `SKIP_DEPLOY_MIGRATIONS=1` skips the step for one deployment, for example while you are investigating a failed migration.

The build uses `DATABASE_URL`, falling back to `NEXT_PUBLIC_DATABASE_URL`, from the deployment's environment. A build that should migrate fails if neither is set.

## A database without a ledger

The repository's first migrations are an introspection baseline. Production was migrated by hand and has no Drizzle ledger (see [Slack migration](slack-setup.md)). Replaying the whole history against it would fail or damage it. So the runner never treats a missing or empty ledger as "nothing applied". It stops the build with an error and applies nothing.

Record the baseline once, after confirming which migrations the database already has:

1. Take a backup and verify it, as in the [0049 repair](production-status-supersessions-repair.md#confirm-the-target-and-take-a-backup).
2. Find the latest migration the database fully has. For example, these read-only checks show whether `0049` and `0050` are present:

   ```sql
   select to_regclass('public.status_supersessions') as has_0049,
          to_regclass('public.admin_status_changes') as has_0050;
   ```

   Inspect each newer migration's SQL the same way. Do not assume a migration is present because its code was deployed.

3. Dry run, then record. The command connects like the app: `DATABASE_URL` with `NODE_ENV=production`, otherwise the `PG*` settings.

   ```sh
   NODE_ENV=production DATABASE_URL=… pnpm db:baseline --through 0049_status_supersessions
   NODE_ENV=production DATABASE_URL=… pnpm db:baseline --through 0049_status_supersessions --apply
   ```

   The dry run prints the target database and how many migrations the next deploy would apply. `--apply` writes ledger entries only; it runs no migration SQL and refuses a ledger that already has entries.

4. Redeploy. The build applies every migration after the baseline.

If you choose a baseline that is too early, the deploy re-runs a migration the database already has. One that creates something fails and is rolled back, but one that only updates data could run twice, so check each candidate migration's SQL. If you choose a baseline that is too late, a migration is skipped and you must apply it by hand.

## Writing migrations

Generate migrations with `pnpm db:generate`. Never edit a migration that has been deployed: the ledger compares timestamps, so an edit is not applied again. Each migration runs in one transaction. A migration that adds an enum value and uses it must be split into two migrations, because PostgreSQL cannot use a new enum value in the transaction that added it. Migrations run before the new code is live, so the deployed code must keep working against the migrated schema until the deploy completes. Adding tables and nullable columns is safe; renaming or dropping something the old code reads is not.

`pnpm db:migrate` uses the same runner against the database the app connects to. It also refuses to run without a ledger.
