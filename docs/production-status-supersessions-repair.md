# Repair the missing status supersessions table

On 4 November 2026, production `/today` failed with digest `3415456739`. The matching server log reported PostgreSQL error `42P01`, `relation "status_supersessions" does not exist`. Deployment `58063c1` already contains migration `0049_status_supersessions.sql`, but inspection found the production migration ledger ended at `0048` and the table was absent.

The database has no historical Drizzle migration journal. Do not run `pnpm db:migrate` or replay earlier migrations to repair it. The targeted entrypoint below reuses the existing `0049` SQL and creates its table, constraints, index and row level security in one transaction. It leaves existing attendance rows unchanged and does not invent a migration ledger entry.

## Confirm the target and take a backup

Use a private PostgreSQL service configuration and password file, or securely supplied `PG*` environment variables. The examples assume a service named `work-production` has already been configured for the intended database with the appropriate TLS settings. Keep passwords out of command arguments, repository files and logs.

From the repository root:

```sh
export PGSERVICE=work-production
psql -X --set=ON_ERROR_STOP=1 --command="SELECT current_database(), current_user, inet_server_addr(), to_regclass('public.status') AS status_table, to_regclass('public.status_supersessions') AS supersessions_table;"
```

Verify the connection identifies the intended production database, `status_table` is `status`, and `supersessions_table` is null. If the table already exists, stop and inspect its schema and migration history instead of rerunning this repair.

Create a custom-format backup outside the repository in a private directory, then check that the archive can be read:

```sh
umask 077
backup_dir=$(mktemp -d /tmp/work-production-backup.XXXXXX)
pg_dump --format=custom --file="$backup_dir/before-0049.dump"
pg_restore --list "$backup_dir/before-0049.dump" > "$backup_dir/archive-list.txt"
```

Proceed only if both commands succeed. Retain the backup securely according to the production backup policy. Record the pre-repair attendance count with `SELECT count(*) FROM public.status;` so it can be compared afterward.

## Apply only migration 0049

```sh
psql -X --file=scripts/sql/repair-status-supersessions.sql
```

The entrypoint sets `ON_ERROR_STOP`, a five-second lock timeout and a sixty-second statement timeout. Its `\ir` path resolves relative to the entrypoint file. Any SQL error stops execution; disconnecting rolls back the transaction. For example, running it when `status_supersessions` already exists fails at `CREATE TABLE` without modifying that table or attendance data. A failed attempt must be investigated before retrying.

No application redeploy is needed for the currently deployed code to see the new table. If your operational migration ledger needs updating, record the successful application through its normal process after verification; do not replay the SQL merely to add a ledger entry.

## Verify the repair

Run these read-only checks through the same verified connection:

```sh
psql -X --set=ON_ERROR_STOP=1 <<'SQL'
SELECT count(*) AS attendance_rows FROM public.status;
SELECT relrowsecurity
FROM pg_class
WHERE oid = 'public.status_supersessions'::regclass;
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.status_supersessions'::regclass
ORDER BY conname;
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'status_supersessions';
-- The same visibility predicate used by attendance reads, without returning user data.
SELECT count(*) AS visible_attendance_rows
FROM public.status AS original
WHERE NOT EXISTS (
  SELECT 1
  FROM public.status_supersessions AS supersession
  JOIN public.status AS replacement ON replacement.id = supersession.replacement_status_id
  WHERE supersession.target_status_id = original.id
);
SQL
```

Check that the attendance count matches the pre-repair count, `relrowsecurity` is true, and the constraints include the composite primary key, the non-self check, and both cascading foreign keys to `public.status`. The indexes must include the primary key index and `status_supersessions_replacement_idx`. The visibility query must complete successfully.

Finally, open `/today` with a fresh authenticated request and check production logs for new `42P01` errors. A successful SQL check alone does not establish that the authenticated page works. Merging this PR does not execute the repair; the database operation is a separate deployment step.
