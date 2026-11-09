# Infrastructure unit-test audit

Reviewed against `db/index.ts`, `drizzle.config.ts`, `scripts/local-database.mjs`,
`scripts/prepare-test-database.ts`, `lib/db-migrations/runner.ts`, their script callers,
`docs/local-development.md`, and `docs/database-migrations.md`.

Every original case and each new case below was inspected. External process, database,
and command boundaries are mocked only where the test concerns orchestration. The
configuration tests execute real modules in fresh child processes against temporary env files.

| File                                         | Disposition | Purpose and changes                                                                                                                                                                                                      | Verification                   |
| -------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| `tests/backend/database-config.test.ts`      | Improved    | Separate `.env` and `.env.local` values make wrong-file selection observable; preserve injected settings; verify real Pool and Drizzle config without connecting.                                                        | 16 cases pass outside sandbox. |
| `tests/backend/db-migrations/runner.test.ts` | Improved    | Replace repository-size/hash-shape smoke check with known SQL, hashes and journal associations; cover malformed ordering, missing files, documented URL precedence and no-op gates.                                      | 13 cases pass.                 |
| `tests/backend/local-database.test.ts`       | Improved    | Keep meaningful orchestration ordering; assert no implicit destructive reset, exact command counts, retries, no remote bootstrap, incomplete-schema errors and connection cleanup. Remove duplicate schema fixture rows. | 21 cases pass.                 |
| `tests/backend/test-database-setup.test.ts`  | Improved    | Preserve role-before-schema sequencing and fail-closed NODE_ENV gate; distinguish connection failure from introspection failure.                                                                                         | 9 cases pass.                  |

## Case review

`database-config.test.ts`:

- Development and absent NODE_ENV, both entrypoints: local settings override an inherited empty password. Independent `.env` values now catch selection of the wrong file.
- Injected test settings, both entrypoints: an environment file cannot redirect CI to a development database.
- Uninjected test settings, both entrypoints: load the test `.env` credentials, not `.env.local`.
- Uninjected production URL, both entrypoints: select `.env` rather than the developer database.
- Injected production URL, both entrypoints: deployment settings take precedence.
- Nonproduction SSL, three NODE_ENV values: Drizzle can connect to the documented local server without SSL.
- Production URL SSL: do not append local SSL settings to URL-based credentials.

`db-migrations/runner.test.ts`:

- Pending migrations: select only entries newer than the baseline; a current ledger returns none.
- Missing ledger: refuse to replay historical SQL and provide the baseline command.
- Unknown ledger timestamp: refuse a branch that cannot account for the database state.
- Read two concrete migrations: journal tags/timestamps stay paired with exact statements and SHA-256 hashes. Empty breakpoint segments are omitted. Hash expectations are fixed fixture values, not computed through the implementation.
- Equal and descending journal timestamps: reject both invalid histories.
- Missing migration file: fail rather than reporting a partial history as complete.
- Production, preview opt-in, development/local/explicit skip: preserve the deployment decision matrix.
- Missing production URL: fail an eligible deployment.
- URL fallback/precedence: use the documented legacy URL only when the primary URL is absent.
- Skipped deployment without credentials and unknown deployment target: do not require or use a database.

The old greater-than-50 migration count, filename regex and hash-format assertions were
removed. They could pass with a wrong tag/SQL association, ignored SQL, or arbitrary
64-character hashes. The concrete fixture replaces those protections. Existing real
PostgreSQL migration tests still exercise transactional application and rollback.

`local-database.test.ts`:

- Five missing/blank required settings and four invalid ports: reject incomplete credentials,
  nonnumeric ports, zero, overflow and fractional ports.
- Both valid port boundaries: do not reject legal edge values.
- Remote host: reject before any Docker or connection side effect.
- Fresh database: start Compose, connect using supplied settings, create policy role, push schema,
  close the pool. Exactly two commands also detect an unrequested destructive reset.
- Authentication failure: fail once without retrying or pushing a schema.
- Current database: still synchronize the schema, do not recreate the existing role, close the pool.
- Explicit reset: run volume deletion before startup and schema push, exactly once each.
- Transient startup failure: retry within the configured budget and then synchronize.
- Exhausted startup retries: report the target and do not push a schema.
- Schema command failure: propagate failure and close the pool without checking incomplete data.
- Schema command succeeds but required column is absent: report the missing column and close the pool.
- Docker socket denial: retain the actionable group-membership diagnostic.

`test-database-setup.test.ts`:

- Missing role: create it before schema introspection and apply exactly once.
- Existing role: do not recreate it; inspect/apply exactly once.
- Connection failure: propagate it before introspection or apply.
- Introspection failure: propagate it without apply.
- SQL apply failure: fail rather than claiming a partially applied schema is ready.
- Role creation failure: do not proceed to schema work.
- Production, development, absent NODE_ENV: reject before any database operation.

No production code changed. No ambiguous infrastructure requirement was resolved by
changing an expectation to fit the current implementation.

## Mutation verification

Temporary Vite pre-transform plugins altered only code loaded for an isolated test run.
No production source file was edited.

- Removing migration empty-segment filtering fails the exact SQL/hash fixture assertion:
  an extra whitespace statement appears. The other 12 migration cases pass.
- Suppressing the post-push missing-schema check fails the missing-column test: the call
  resolves as ready instead of rejecting. The other 20 bootstrap cases pass.

Both focused files passed again with the normal configuration. The final full-suite
validation is recorded in the main ledger.
