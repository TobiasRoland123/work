# Historical Slack attendance import

This is an operator CLI, restricted to an active `ADMIN` in the selected database. It does not run from the normal Slack queue. No hosted branch was provisioned and no historical import was executed during implementation. Local tests cannot verify your hosted schema, network routes, Slack retention, tokens, or bills.

The importer starts at `2026-01-01T00:00:00+01:00`, or Slack timestamp `1767222000.000000`. A run records its final cutoff and processes Copenhagen calendar months in order. January must be reviewed before February starts. Message selection uses original send time. It does not fetch December context, reconstruct deleted messages, or recreate an edit trail. A January 31 announcement applying to February 1 retains its whole interval.

## Before running any importer command

1. **Agree the branch cost and deletion date.** In the Supabase dashboard, verify the production project reference and organization, branch availability, current compute/storage/usage charges and billing owner. Record the agreed spending limit and cleanup date before creating `slack-import-2026`. Do not enable `Include data` without a separate decision about copying personal data. No quoted historical price is a cost agreement.
2. **Provision and identify the isolated branch.** Save its project reference, direct or session-pooler host, port, database, username, and connection details in your secret manager. Independently compare them with production. The rehearsal host or pooler username must differ from production. Do not merge this branch over production. Import validated history into production in a separate run later.
3. **Verify and prepare the schema.** Compare the actual tables, columns, constraints, triggers and policies against this checkout, including `status`, `status_corrections`, `status_supersessions`, `slack_messages` and the history tables. Compare both `supabase_migrations.schema_migrations` and `drizzle.__drizzle_migrations`. Dashboard branches derive schema from Supabase migration history, not necessarily the current live schema. Follow [database migration instructions](database-migrations.md) to establish an honest baseline and apply pending Drizzle migrations. Never baseline beyond a migration actually present, and never run old migrations blindly on an empty branch.
4. **Seed controlled fixtures.** Create the required organization, an active ADMIN operator, user IDs and Slack team/user mappings. Include an inactive former employee without restoring login, an unmapped Slack author, an inactive mentioned colleague, existing Slack Declarations, a newer live edit/deletion, manual Declarations, Corrections and supersession links. Prefer synthetic attendance with real mapping IDs. Record any approved production-data copy and its deletion policy. Keep original production IDs where a controlled copy is required.
5. **Isolate every connection.** Use a separate app deployment only if you need UI rehearsal. Set its `DATABASE_URL` to the branch; clear the legacy `NEXT_PUBLIC_DATABASE_URL` fallback. Local app and migration commands instead use `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, and `.env.local` can override inherited values. The importer deliberately uses neither set. Configure branch-only `NEXT_PUBLIC_SUPABASE_URL` and anon key or leave Realtime disabled. Audit copied database webhooks, triggers, Edge Functions, `cron.job`, scheduled directory sync, Vercel cron, queue consumers and any old deployment. Disable rehearsal schedules and external webhooks. Do not point a rehearsal consumer at production `slack-status`. The importer itself sends no queue jobs or Realtime broadcasts, but database triggers can still do so.
6. **Check Slack read access.** Obtain an installed bot token for the expected workspace and public channel with `channels:history` and enough channel read access for `conversations.info`. Verify membership and retention through the read-only preflight below. Use a read-only scoped token where possible. Never give the importer permission to post. Ask a workspace administrator to confirm the earliest accessible history and retention setting; an empty result is not proof there were no announcements.
7. **Enable temporary Echo-off mode everywhere affected.** Set `SLACK_HISTORY_IMPORT_MODE=rehearsal` on the rehearsal app, workers and cron instances. For production rollout, use `production`. Restart or redeploy all affected instances and drain old instances that retain the old environment. Refresh open browser tabs after the deployment. Check both personal and admin Set status controls, `POST /api/status`, and direct server actions; they must explain temporary unavailability. Exercise queued/scheduled Echo attempts and confirm no Slack write. Keep production live Slack ingestion running. A paused or failed run must retain Echo-off mode and blocked manual mutations.
8. **Prepare parser and spending settings.** Pick the parser version accepted by this checkout, model ID, maximum run budget and maximum per-request charge reservation. Freeze the JSON configuration below for the run. Prepare the AI Gateway credential through your secret manager. Review a small representative January sample before committing to the budget. Existing Learned Shorthand is neither read nor trained during import. Report unresolved or ambiguous text for review.
9. **Prepare backup and undo evidence.** Take a rehearsal snapshot before apply. Plan a restorable production backup before any production import. Verify restore into a separate disposable database, not over production. Retain the backup reference and a reviewed rehearsal report. Exercise undo on January, including restoration of prior absence, removal of imported supersessions, and preservation of Corrections and later live/manual changes, before approving production.

Supabase's current documentation says branches start without production data by default; `Include data` requires the applicable PITR option. Settings and deployed Edge Functions may be copied, and Database Webhooks are enabled. Check these explicitly. See [dashboard branching](https://supabase.com/docs/guides/deployment/branching/dashboard), [branching billing](https://supabase.com/docs/guides/platform/manage-your-usage/branching) and [branch behavior](https://supabase.com/docs/guides/deployment/branching). The November 2026 CLI v3 change alters target defaults, so use the dashboard for these instructions or inspect your installed CLI's `--help` before operating it.

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
  "parserVersion": "history-2026-v1",
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
2. Verify production identity independently, take and test a backup, and record its location. Set `SLACK_IMPORT_REHEARSAL_REPORT` and `SLACK_IMPORT_BACKUP_REFERENCE` to non-secret evidence identifiers. These are required operator attestations, not automated proof of a backup.
3. Configure a new production JSON file and explicit production target variables. Enable `SLACK_HISTORY_IMPORT_MODE=production` on every production app/worker/cron instance, retire old instances, and verify Set status and all Echo writes are blocked while live intake continues. Set isolation attestation only after checking production consumers and live priority. Run preflight again and inspect its exact identity before init.
4. Start a new production run with an agreed fixed cutoff, never transfer attendance by merging the rehearsal branch. Execute and review one month at a time. Reconcile history around the fixed cutoff against live processing and inspect all stale edit/deletion conflicts. Publish coverage limitations with historical statistics.
5. After final review, reconcile pending Echo state before restoration. Unset `SLACK_HISTORY_IMPORT_MODE` or set it to `off` on every affected deployment and restart them. Refresh open browser tabs and verify a manual Set status succeeds, its Echo posts once, personal/admin controls return, scheduled Echo processing recovers and live Slack ingestion still works. Do not restore manual controls while Echo remains disabled. Pausing or failing an import does not turn the mode off automatically.
6. Export sanitized reports and required audit/undo metadata to restricted storage. Apply the agreed source-text retention policy, including database backups and logs. Avoid exporting raw messages into issue comments or public artifacts. Remove temporary secrets and disable rehearsal deployment/consumers before deleting the Supabase branch. Delete the branch by the agreed date, verify its resources are gone and check the final bill.

## Access, source text and limitations

Database administrators can read import records; ordinary authenticated users must not receive access to the private history tables. Reports can contain attendance details and personal reasons. Store them with the same restrictions as attendance data. Raw source text is stored in the isolated import tables until explicit month review, which purges it. Proposal details and prior/after snapshots remain for attendance audit and undo, and can themselves contain personal reasons. Set a retention/deletion date for these records and backups under the organization's policy. Unreviewed or failed runs retain source text and require an explicit administrator cleanup decision. Replay after purge requires a new fetch/run. Deleted or expired text cannot be reconstructed from Slack reliably. Do not copy raw source text into operational logs.

Existing Slack revisions involving Corrections or supersession relationships, existing earlier/later live messages in the same author/day context, and messages naming colleagues are held for review. This includes inactive mentioned colleagues. The CLI does not offer an automatic resolution command for these cases. Review reports before deciding whether further implementation or a separate audited correction is necessary. Mapped inactive authors are imported without changing their login state; unmapped authors remain in review.

Cost accounting reserves `maxRequestUsd` before each model request and retains the reservation even when a request fails. Set an external AI Gateway/provider hard spending cap as well: an unexpectedly expensive completed request can exceed a reservation before the importer learns the actual charge and pauses. The report is conservative reserved spending, not an invoice. Per-month sample estimates divide reserved cost by processed messages and project that observed average onto fetched pending messages. Unsampled months and unavailable history are not estimated; text complexity and retries can raise actual costs.

Hosted provisioning, actual cost agreement, hosted migration/seed verification, production isolation, Slack access/retention, paid model extraction and backup restoration remain operator tasks. Passing local tests is not evidence those steps happened.

## Local automated verification

Use a fresh disposable PostgreSQL database with no real people or Slack data. The integration suite inserts fixtures and exercises apply/undo; it must never receive a production or hosted rehearsal URL. It deliberately skips when `SLACK_HISTORY_TEST_DATABASE_URL` is absent. Recreate the disposable database between repeated integration runs because fixtures are retained for inspection.

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

Do not execute that command against the freshly pushed current schema, where the history tables already exist. Direct SQL testing does not record Drizzle's ledger; production and hosted rehearsal migrations must use the documented migration runner after baseline verification. Local assertions use mocked Slack/model responses or rules-only extraction. They do not establish hosted Slack access, retention, AI billing accuracy, branch isolation or successful backup restoration.
