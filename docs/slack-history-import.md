# Historical Slack attendance import

This is an operator CLI, restricted to an active `ADMIN` in the selected database. It does not run from the normal Slack queue. The rollout uses a backup of the current database and an isolated local rehearsal copy; no paid Supabase branch is required. No production backup, hosted branch or historical import was executed during implementation. Local tests cannot verify your hosted schema, network routes, Slack retention, tokens, or bills.

The importer starts at `2026-01-01T00:00:00+01:00`, or Slack timestamp `1767222000.000000`. A run records its final cutoff and processes Copenhagen calendar months in order. January must be reviewed before February starts. Message selection uses original send time. It does not fetch December context, reconstruct deleted messages, or recreate an edit trail. A January 31 announcement applying to February 1 retains its whole interval.

## Before running any importer command

1. **Back up the current state before changing it.** Independently verify the production project and database target, then create a protected database dump before applying migration `0053` or importing attendance. Record the source identity, database version, start/end time, archive checksum and retention date. The archive contains personal data. Keep it outside Git and restrict access. No paid branch or paid point-in-time recovery feature is needed for this workflow.
2. **Restore an isolated local rehearsal copy.** Use an empty local PostgreSQL database on a separate port/database name and verify its identity before restoring. Match the source PostgreSQL major version and required extensions. Managed Supabase roles, schemas, policies and functions may need a compatible local Supabase stack or explicit dependency preparation. Do not ignore restore errors. See the backup/restore procedure below. Never overwrite production with the rehearsal copy.
3. **Verify and prepare the local schema.** Compare restored tables, columns, constraints, triggers and policies against the source and this checkout, including `status`, `status_corrections`, `status_supersessions`, `slack_messages` and the migration ledgers. Follow [database migration instructions](database-migrations.md) to verify the baseline and apply pending migrations to the local copy first. Never baseline beyond a migration actually present. An application-only export is not a full database backup.
4. **Verify mappings and add controlled fixtures locally.** Keep the restored user IDs and Slack mappings. Ensure an active ADMIN operator is present. Include an inactive former employee without restoring login, an unmapped author, an inactive mentioned colleague, existing Slack Declarations, newer live edit/deletion fixtures, manual Declarations, Corrections and supersession links. Record the approved local production-data copy and its deletion date. Synthetic conflict fixtures belong only in the rehearsal database.
5. **Isolate every connection.** Prefer running the CLI locally with no rehearsal app, worker or scheduler. If you need UI rehearsal, point the local app's `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD` and `PGDATABASE` at the local copy; check `.env.local`, which can override inherited settings. A production-mode app instead uses `DATABASE_URL` with the legacy `NEXT_PUBLIC_DATABASE_URL` fallback. The importer deliberately uses neither set. Remove production Realtime credentials from the rehearsal process. Audit restored database webhooks, triggers, extensions and `cron.job`; disable external calls and schedules in the local copy before exercising it. Do not start production queue consumers, directory sync or copied Edge Functions. The importer itself sends no queue jobs or Realtime broadcasts, but database triggers can still do so. Leave production ingestion running unchanged during local rehearsal.
6. **Check Slack read access.** Obtain an installed bot token for the expected workspace and public channel with `channels:history`. For WORK 2.0, preflight and every fetch verify the pinned bot, workspace, and #wørk channel IDs. They require `channels:history` as the only installed conversation-history scope and a successful history request to that channel. Other targets use `conversations.info` to verify public channel membership and require its read scope. Preflight samples January only. Use a read-only scoped token where possible. Never give the importer permission to post. Ask a workspace administrator to confirm the earliest accessible history and retention setting; an empty result is not proof there were no announcements.
7. **Enable temporary Echo-off mode in the affected environment.** Set `SLACK_HISTORY_IMPORT_MODE=rehearsal` for the local importer and any local app/worker used for rehearsal. Do not change production's mode just to test locally. For the eventual production import, use `production` on every affected production instance. Restart those instances and refresh browser tabs. Check personal/admin Set status controls, `POST /api/status`, and direct server actions; they must explain temporary unavailability. Exercise queued/scheduled Echo attempts and confirm no Slack write while live intake continues. A paused or failed run must retain Echo-off mode and blocked manual mutations.
8. **Prepare parser and spending settings.** Pick the accepted parser version, model ID, maximum run budget and maximum per-request charge reservation. Freeze the JSON configuration below for the run. Prepare the AI Gateway credential through your secret manager. Review a representative January sample before committing to the budget. Avoiding a paid database branch does not remove model API costs. Existing Learned Shorthand is neither read nor trained during import.
9. **Prepare restore and undo evidence.** Verify the backup by restoring it locally and checking its contents, not just by checking that the file exists. Rehearse January and exercise undo, including exact prior-state restoration, removal of imported supersessions, and preservation of Corrections and later live/manual changes. Keep the report and restore evidence. Take a fresh production backup immediately before production migration/import, after rehearsal is approved.

## Backup and local restore

These are operator command templates, not commands already executed against your database. Configure a protected libpq service file with two independently checked connections: `work_source` for the existing hosted database and `work_rehearsal` for an **empty local** database. Supply passwords through a protected `PGPASSFILE` or the usual `.pgpass`, never in commands, Git or this document. On Unix, the password file must have mode `0600`. Keep the service file private too. For example, the non-secret connection fields in that file are:

```ini
[work_source]
host=VERIFIED_SOURCE_HOST
port=VERIFIED_SOURCE_PORT
dbname=VERIFIED_SOURCE_DATABASE
user=VERIFIED_SOURCE_USER
sslmode=verify-full

[work_rehearsal]
host=127.0.0.1
port=VERIFIED_LOCAL_PORT
dbname=work_slack_rehearsal
user=VERIFIED_LOCAL_USER
```

Configure the source TLS certificate trust according to the supplied connection instructions. Export `PGSERVICEFILE` and `PGPASSFILE` as paths to those private files. Check source and local identities without printing passwords:

```sh
psql 'service=work_source' --no-psqlrc --set ON_ERROR_STOP=1 --command 'select current_database(), current_user, inet_server_addr(), inet_server_port(), version();'
psql 'service=work_rehearsal' --no-psqlrc --set ON_ERROR_STOP=1 --command 'select current_database(), current_user, inet_server_addr(), inet_server_port(), version();'
```

Use a `pg_dump` client that supports the source server version; using the same major version avoids exporting from a server newer than the client. Use that toolchain and a matching local server for the rehearsal. Choose a new protected backup directory for each snapshot. The following writes only local files while reading the source:

```sh
set -e
umask 077
# Set IMPORT_BACKUP_DIR to a new private directory outside the checkout.
: "${IMPORT_BACKUP_DIR:?Set a new private backup directory first}"
mkdir -- "$IMPORT_BACKUP_DIR"
pg_dump --dbname='service=work_source' --format=custom --file="$IMPORT_BACKUP_DIR/current-state.dump"
pg_restore --list "$IMPORT_BACKUP_DIR/current-state.dump" > "$IMPORT_BACKUP_DIR/archive-contents.txt"
sha256sum "$IMPORT_BACKUP_DIR/current-state.dump" > "$IMPORT_BACKUP_DIR/current-state.sha256"
```

Stop on any failed command and inspect warnings. The archive list/checksum checks readability and integrity, not restorability. Inspect the archive and external dependencies before restoring. A database dump does not include cluster-wide roles/tablespaces, deployed application configuration, or external object-storage files. Arrange those separately if required for disaster recovery. A managed Supabase dump may reference extensions or roles unavailable in ordinary PostgreSQL; resolve those dependencies in the local environment before treating the backup as verified. If only application schemas are exported for rehearsal, retain the complete recovery backup separately and document what the rehearsal export excludes.

Restore only to the verified empty local target. `--no-owner` and `--no-privileges` avoid importing production ownership and grants into the local copy; they do not eliminate roles referenced by RLS policies or missing extension/function dependencies, and they do not validate production access controls.

```sh
pg_restore --dbname='service=work_rehearsal' --no-owner --no-privileges --exit-on-error --single-transaction "$IMPORT_BACKUP_DIR/current-state.dump"
```

Expected result: exit code zero, followed by verified table counts, required user/Slack mappings, representative Declaration intervals and timestamps, Correction/supersession links, constraints and migration ledger entries. Compare with recorded source evidence, allowing for live rows created after the snapshot. Restore/inspect the Drizzle ledger before running the repository migration runner locally. Then run importer preflight against the local copy after its migrations are current. Do not use `db:prepare-test` or schema push to prepare a copy containing real attendance.

`pg_dump` takes a consistent snapshot while normal reads/writes continue. It does not include changes made after that snapshot. For example, restoring a 10:00 backup at 11:00 would discard valid Slack arrivals recorded during that hour. Prefer the importer's month/run `undo`, which preserves later changes and reports conflicts. A full production restore is a separate recovery operation requiring a maintenance and reconciliation plan; it must never run automatically while live ingestion continues. This runbook deliberately contains no production restore command.

References: [PostgreSQL SQL dumps](https://www.postgresql.org/docs/current/backup-dump.html), [pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html), [pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html), [connection service files](https://www.postgresql.org/docs/current/libpq-pgservice.html), and [password files](https://www.postgresql.org/docs/current/libpq-pgpass.html).

## Configuration and read-only checks

Keep credentials out of committed files and shell history. Export these variables from your secret manager in a dedicated terminal:

| Variable                          | Value to supply                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------- |
| `SLACK_IMPORT_DATABASE_URL`       | Full connection URL for the independently verified rehearsal target                               |
| `SLACK_IMPORT_EXPECT_HOST`        | Expected hostname from that target                                                                |
| `SLACK_IMPORT_EXPECT_DATABASE`    | Expected database name                                                                            |
| `SLACK_IMPORT_EXPECT_USER`        | Exact connection username, including pooler project suffix if present                             |
| `SLACK_IMPORT_BOT_TOKEN`          | Installed token for read-only Slack calls                                                         |
| `SLACK_HISTORY_IMPORT_MODE`       | `rehearsal` now; `production` only after readiness review                                         |
| `SLACK_IMPORT_ISOLATION_VERIFIED` | `yes`, only after completing the isolation checks above                                           |
| `SLACK_EXTRACTION_MODEL`          | The CLI sets this to the frozen JSON `model` before extraction; direct core callers must match it |
| `AI_GATEWAY_API_KEY`              | AI credential with an agreed spend cap, when using model extraction                               |

The expected host/database/user are independent guard values, not values to derive automatically from an unverified URL. The CLI refuses to fall back to `DATABASE_URL` or `PG*`. Its identity output contains no password. A pooler can report the underlying `current_user` differently from the URL username; inspect both and compare with the dashboard.

Store non-secret configuration in `.local/slack-import/rehearsal.json`. Use the actual mapped ADMIN ID and real Slack IDs. This example has a fixed cutoff at the end of January for a first rehearsal; a later run can record a later final cutoff.

```json
{
  "teamId": "EXPECTED_WORKSPACE_ID",
  "channelId": "EXPECTED_PUBLIC_CHANNEL_ID",
  "adminUserId": "EXISTING_ACTIVE_ADMIN_USER_ID",
  "model": "openai/gpt-6-luna",
  "budgetUsd": 5,
  "maxRequestUsd": 0.05,
  "parserVersion": "history-2026-v3",
  "mode": "rehearsal",
  "cutoff": "2026-02-01T00:00:00+01:00",
  "coverage": {
    "earliestAvailable": null,
    "retentionConfirmed": false
  }
}
```

The dollar amounts are example limits, not a prediction or authorization to spend. Replace them after sample estimation and approval. Set `earliestAvailable` and `retentionConfirmed` only after verifying retention; leave unknown coverage unknown. Do not equate missing history with office attendance.

```sh
pnpm slack:history --help
pnpm slack:history preflight --config .local/slack-import/rehearsal.json
```

Expected output includes the credential-free `targetIdentity`, server-reported database/role/address, latest Drizzle ledger entry, required tables, matching Slack workspace/channel, installed scopes if returned by Slack, `historyReadable: true`, and retention warnings. A wrong target, inactive/non-admin operator, missing schema/ledger or a latest ledger entry that does not match this checkout, wrong workspace, non-public channel or missing bot membership fails. Save sanitized verification evidence. Preflight does not create an import run or change attendance. It cannot prove that some other deployment is isolated.

## Execution after setup is complete

These commands intentionally change the selected database's import records. `preview` may incur AI cost and store proposed changes but does not apply attendance. `apply` and `undo` change attendance. Do not run them until setup is complete.

```sh
pnpm slack:history init --config .local/slack-import/rehearsal.json
```

Save the returned run ID as `RUN_ID`. The run freezes configuration, fixed cutoff and monthly windows. Keep the same configuration file for subsequent commands.

```sh
pnpm slack:history fetch --config .local/slack-import/rehearsal.json --run "$RUN_ID"
pnpm slack:history report --config .local/slack-import/rehearsal.json --run "$RUN_ID"
```

Repeat bounded `fetch` commands until the current month reports fetching complete. A short page is not completion; pagination must finish. Check fetched counts, checkpoint and coverage. Cursor expiration resumes with timestamp overlap and deduplication. Respect a reported `Retry-After` before retrying, and stop if live intake is delayed.

```sh
pnpm slack:history preview --config .local/slack-import/rehearsal.json --run "$RUN_ID" --limit 10
pnpm slack:history report --config .local/slack-import/rehearsal.json --run "$RUN_ID"
```

The current CLI fetches the whole recorded month window before preview and previews the next chronological messages, up to ten per call. For a first-week-only rehearsal, create a separate run with `cutoff` set to `2026-01-08T00:00:00+01:00`; this records January as a partial month. A full January rehearsal needs a new run and a clean/restored rehearsal database after undoing the sample. It has no week-selection option. Select representative messages from the January report and continue bounded previews until the desired examples have been covered. Include Danish shorthand, edits, “arriving at 10” then “actually 11”, a former employee, ambiguity, a January 31 “tomorrow”, and a manual Correction. Inspect proposed intervals next to existing records, author outcomes, skip/review reasons and cost. Run additional bounded previews only after assessing the sample and budget. Do not change frozen model/parser settings mid-run.

```sh
pnpm slack:history apply --config .local/slack-import/rehearsal.json --run "$RUN_ID" --limit 10
pnpm slack:history report --config .local/slack-import/rehearsal.json --run "$RUN_ID"
```

Save each preview command's `batch` output in restricted storage; it includes every item examined in that batch, while the report's examples are capped. Repeat bounded apply commands until the month has no pending proposals. Expect created/duplicate/ignored/review/failed counts, with incomplete coverage visible. Safe newer revisions can replace an existing Declaration after comparing its prior state. Revisions touching Corrections or supersession relationships remain in review. Rerun a completed batch and verify no duplicate Declarations. Test pause and resume, a process interruption, transient extraction failure, exhausted budget and expired cursor. Verify source revisions and timestamps, not just counts.

```sh
pnpm slack:history pause --config .local/slack-import/rehearsal.json --run "$RUN_ID"
pnpm slack:history resume --config .local/slack-import/rehearsal.json --run "$RUN_ID"
pnpm slack:history undo --config .local/slack-import/rehearsal.json --run "$RUN_ID"
pnpm slack:history report --config .local/slack-import/rehearsal.json --run "$RUN_ID"
```

After investigating a transient failure, `resume` resets exhausted failed-item attempts for another bounded retry cycle. Budget exhaustion goes to review; increasing the frozen budget requires a new run.

Undo removes rows created by this run only when their recorded after-state still matches. Safe revision changes record their prior state, including original IDs, for restoration. Revisions involving Correction or supersession relationships remain in review. Undo leaves later user/live changes intact. Add `--month 2026-01` to undo January only; omit it to undo the run. Any conflict needs review; never delete all Slack rows as a fallback. Compare with the pre-apply snapshot. Create a new rehearsal run after an undo when testing a fresh apply sequence.

```sh
pnpm slack:history review --config .local/slack-import/rehearsal.json --run "$RUN_ID"
```

Run `review` only after inspecting the month's final report. It explicitly advances to the next recorded month, or completes the final month. Do not automate a loop that approves all months. Follow the same fetch, preview, apply, report and review cycle through the fixed cutoff.

## Production readiness and restoration

1. Keep the reviewed rehearsal report, schema/migration evidence, representative examples, cost estimate, failed/review decisions and successful undo/restore evidence. Resolve incorrect extraction before production. Repeat tests after any implementation or parser change.
2. Verify production identity independently, take a fresh backup before applying production migration `0053` or importing attendance, verify restoration on a separate local target, and record its location. Apply the verified migrations only after this backup exists. Set `SLACK_IMPORT_REHEARSAL_REPORT` and `SLACK_IMPORT_BACKUP_REFERENCE` to non-secret evidence identifiers. These are required operator attestations, not automated proof of a backup.
3. Configure a new production JSON file and explicit production target variables. Enable `SLACK_HISTORY_IMPORT_MODE=production` on every production app/worker/cron instance, retire old instances, and verify Set status and all Echo writes are blocked while live intake continues. Set isolation attestation only after checking production consumers and live priority. Run preflight again and inspect its exact identity before init.
4. Start a new production run with an agreed fixed cutoff, never overwrite production with the local rehearsal database. Execute and review one month at a time. Reconcile history around the fixed cutoff against live processing and inspect all stale edit/deletion conflicts. Publish coverage limitations with historical statistics.
5. After final review, reconcile pending Echo state before restoration. Unset `SLACK_HISTORY_IMPORT_MODE` or set it to `off` on every affected deployment and restart them. Refresh open browser tabs and verify a manual Set status succeeds, its Echo posts once, personal/admin controls return, scheduled Echo processing recovers and live Slack ingestion still works. Do not restore manual controls while Echo remains disabled. Pausing or failing an import does not turn the mode off automatically.
6. Export sanitized reports and required audit/undo metadata to restricted storage. Apply the agreed source-text retention policy, including database backups and logs. Avoid exporting raw messages into issue comments or public artifacts. Remove temporary credentials and stop local rehearsal apps/consumers. Delete the local database, its volumes and copied personal data by the agreed retention date, while preserving approved recovery backups and audit evidence. No hosted branch needs provisioning or cleanup.

## Access, source text and limitations

Database administrators can read import records; ordinary authenticated users must not receive access to the private history tables. Reports can contain attendance details and personal reasons. Store them with the same restrictions as attendance data. Raw source text is stored in the isolated import tables until explicit month review, which purges it. Proposal details and prior/after snapshots remain for attendance audit and undo, and can themselves contain personal reasons. Set a retention/deletion date for these records and backups under the organization's policy. Unreviewed or failed runs retain source text and require an explicit administrator cleanup decision. Replay after purge requires a new fetch/run. Deleted or expired text cannot be reconstructed from Slack reliably. Do not copy raw source text into operational logs.

Parser `history-2026-v3` checks historical interpretations at preview and apply. It holds home-working proposals when the source signals a partial day and the proposed end lacks a matching clock boundary. For example, “WFH until I come in later” requires review. “WFH today” can cover the date, and “WFH until 10:30, then in the office” can produce a timed transition. Check the proposed dates, bounds and office presence against the source during review. The parser also holds any combination of AWAY and IN_OFFICE from one announcement. A v1 or v2 run remains available for report, pause and undo using its recorded configuration. Start a fresh v3 run for preview and include earlier spending in the same authorization.

Existing Slack revisions involving Corrections or supersession relationships, existing earlier/later live messages in the same author/day context, and messages naming colleagues are held for review. This includes inactive mentioned colleagues. The CLI does not offer an automatic resolution command for these cases. Review reports before deciding whether further implementation or a separate audited correction is necessary. Mapped inactive authors are imported without changing their login state; unmapped authors remain in review.

The default accounting mode reserves `maxRequestUsd` before dispatch and keeps that reservation even if the request fails or the completion reports a lower price. Set an independent payment limit across runs and account for retries. If a completed request exceeds its reservation, the importer records the overrun and pauses.

An operator can freeze `"receiptAccounting": "verified-gateway-v1"` in a new run's configuration when using a dedicated Gateway payment guard. Both `budgetUsd` and the guard's cross-run limit must stay within the authorized amount. For example, with a USD 0.60 reservation and a verified USD 0.002311 generation debit, the importer returns USD 0.597689 to the run's remaining budget. The guard must correlate the exact model, run and generation with its own dispatch and independently verify the Gateway billing receipt, including surcharges and any provider-billed costs. The current operator guard retains the full reservation for BYOK. Missing receipts, unverified charges and failed requests keep their reservation and pause the run for investigation. Completed extractions can still be inspected. A missing guard stops a paid extraction before dispatch. Keep using the same durable cross-run ledger after restarting. Source-message text and completion-body cost estimates cannot authorize a refund.

The report's sample estimates project the observed per-message cost onto pending fetched messages. Unresolved reservations can make these estimates conservative. Unsampled and unavailable history have no estimate.

The actual production backup, verified local restore, migration/mapping checks, production isolation, Slack access/retention and any paid model extraction remain operator tasks. No Supabase branch purchase or provisioning is required. Passing local tests is not evidence those steps happened.

## Local automated verification

Use a fresh disposable PostgreSQL database with no real people or Slack data. The integration suite inserts fixtures and exercises apply/undo; it must never receive a production URL or a local rehearsal copy containing real data. It deliberately skips when `SLACK_HISTORY_TEST_DATABASE_URL` is absent. Recreate the disposable database between repeated integration runs because fixtures are retained for inspection.

Point all `PG*` settings at that disposable database and ensure `.env` cannot redirect them. Prepare its schema with the repository's test setup, then set the test URL from the same independently verified local target:

```sh
NODE_ENV=test pnpm db:prepare-test
# Export SLACK_HISTORY_TEST_DATABASE_URL from the verified disposable local target.
pnpm exec vitest run --project backend tests/backend/lib/slack-history-integration.test.ts
pnpm exec vitest run --project backend tests/backend/lib/slack-history.test.ts tests/backend/lib/slack-history-operator.test.ts tests/backend/lib/slack-history-report.test.ts tests/backend/lib/slack-import-mode.test.ts
pnpm typecheck
```

The schema push is only a test-fixture setup and does not verify migration-ledger deployment. To exercise migration `0053_slack_history_import.sql` itself, use a separate disposable database already prepared with the schema through `0052`, verify that the history tables do not exist, and apply that SQL file directly with `psql` using explicit local host/port/user/database settings:

```sh
psql --no-psqlrc --set ON_ERROR_STOP=1 --single-transaction --file db/0053_slack_history_import.sql
```

Do not execute that command against the freshly pushed current schema, where the history tables already exist. Direct SQL testing does not record Drizzle's ledger; production and restored rehearsal migrations must use the documented migration runner after baseline verification. Local assertions use mocked Slack/model responses or rules-only extraction. They do not establish hosted Slack access, retention, AI billing accuracy, rehearsal isolation or successful backup restoration.

### Withholding reviewed source revisions

After preview, record unsupported or ambiguous proposals in a private JSON file. For example, a synthetic January manifest with one decision looks like this.

```json
{
  "month": "2026-01",
  "revisions": [
    {
      "messageKey": "T-example:C-example:1767265200.000001",
      "revision": "1767265200.000001",
      "reason": "ambiguous_interpretation"
    }
  ]
}
```

Use the exact message key and revision from the private preview. The other accepted reason is `unsupported_interpretation`. Before applying, run `pnpm slack:history withhold --config PRIVATE_CONFIG --run RUN_UUID --manifest PRIVATE_FILE`. Inspect the updated report and retain the manifest with the rehearsal evidence. The command records the decisions in the current run month, retains the proposals, and marks each specified revision for review. A missing source, changed revision, or ineligible outcome rejects the whole file. To add decisions, register a new file containing the earlier decisions and the additions.

Register the reviewed rehearsal manifest again after production preview. Production apply and final month review both require registration and recheck the held items. For a month with zero manual holds, explicitly register its month and an empty `revisions` array. If a production revision differs from rehearsal, inspect that source and retain the reconciliation evidence before registering a revised production manifest.
