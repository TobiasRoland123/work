# Wørk

Wørk shows who is in Charlie Tango's Copenhagen office. Colleagues announce attendance
exceptions in Slack or in the app, and Wørk displays them on a shared day and week overview.
It is built with Next.js, React, PostgreSQL and Drizzle.

## Local development

Use pnpm 9.15.5, as pinned in `package.json` and `mise.toml`, and install Docker with
permission to run `docker compose` as your user.

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env.local`. Set `AUTH_SECRET` to a long random string and
   configure `AI_GATEWAY_API_KEY` for AI attendance parsing. Keep `SLACK_TEAM_ID=T_LOCAL`
   and `SLACK_CHANNEL_ID=C_LOCAL` for sandbox data.
3. Prepare the local database and fixture profiles, then start the app:

   ```sh
   pnpm local:db
   pnpm sandbox:seed
   pnpm dev
   ```

Open [http://127.0.0.1:3000/sandbox](http://127.0.0.1:3000/sandbox). The Local Sandbox
replaces Slack during development, so no tunnel or development Slack app is needed.
On repeated starts, run `pnpm dev`; use `pnpm db:up` first if the database container is stopped.

The sandbox page is `app/sandbox/page.tsx`; the attendance overview is
`app/(authenticated)/today/page.tsx`. Changes appear as you edit.

See [Local development](docs/local-development.md) for sandbox controls, existing database
setup, legacy role migration and checks that require a Slack preview deployment.

## Documentation

- [Office presence](docs/office-presence.md): attendance rules, planning, corrections,
  pinned colleagues and Echoes posted to #wørk.
- [Slack setup](docs/slack-setup.md): login, directory sync, attendance import and
  deployment configuration. Read before database cutover or deployment.
- [Application access](docs/access-control.md): Employee, Manager and Admin permissions.
- [Message quality review](docs/message-quality.md): import conversion, missed messages
  and reviewer access.
- [Employee stats](docs/employee-stats.md): team and individual attendance statistics.
- [Theming](docs/theming.md): Default, Ocean, Sunset and Lavender palettes in light and dark.
- [Install on your phone](docs/pwa.md): installation, the phone invitation and offline behavior.
- [Domain vocabulary](CONTEXT.md): Declarations, Resolved Status, Echoes and sandbox terminology.

## Database commands

| Command                       | Purpose                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| `pnpm local:db`               | Start the disposable Docker database and prepare its schema.                             |
| `pnpm sandbox:seed`           | Seed local Sandbox Profiles.                                                             |
| `pnpm local:db:reset`         | Delete the disposable Docker volume and rebuild it. Rerun `pnpm sandbox:seed` afterward. |
| `pnpm db:up` / `pnpm db:down` | Start or stop the PostgreSQL container.                                                  |
| `pnpm db:generate`            | Generate migration files after schema changes.                                           |
| `pnpm db:push`                | Push the current schema directly to a development database.                              |
| `pnpm db:studio`              | Open the database browser at [Drizzle Studio](https://local.drizzle.studio/).            |
| `pnpm db:seed`                | Synchronize real Slack workspace users. Requires Slack credentials.                      |
| `pnpm db:migrate`             | Apply pending migrations to a database with an existing migration ledger.                |

`pnpm db:start` is a combined command that generates and pushes schema changes, installs
triggers, synchronizes real Slack users, and starts Studio and the WebSocket server. Use
the `local:db` and `sandbox:seed` workflow above for local sandbox development.

Fresh development databases use schema push rather than replaying the historical migration
chain. An existing database without a migration ledger needs a verified baseline before
migrations can run. See [Database migrations](docs/database-migrations.md).

## Deployment

Vercel uses `pnpm db:deploy-migrate && pnpm build`. Production builds apply pending migrations
before building the app. Preview builds apply them only with `DEPLOY_MIGRATIONS_PREVIEW=1`;
enable that only when previews have a database of their own. Local builds and CI do not
automatically migrate databases.

Follow [Slack setup](docs/slack-setup.md) for environment configuration and
[Database migrations](docs/database-migrations.md) for baseline checks and deployment controls.

## Testing and checks

Vitest has separate `backend`, `components` and `storybook` projects. `pnpm test` starts
Vitest across its configured projects; it does not run the separate Playwright E2E suite.

### Backend tests

Use a disposable test database. Set its `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD` and
`PGDATABASE` values in the shell or `.env`. With `NODE_ENV=test`, the database module reads
`.env`, not `.env.local`.

```sh
NODE_ENV=test pnpm db:prepare-test
pnpm exec vitest run --project backend
```

The preparation command creates the required database policy role and applies the current
schema. `pnpm test:backend` runs the same project in Vitest's default mode.

### Components and Storybook

Install Playwright browsers and system dependencies before running browser tests, as CI does:

```sh
pnpm exec playwright install --with-deps
pnpm exec vitest run --project components
```

For the separate Storybook test runner, start `pnpm storybook` and wait for it to be ready
on port 6006. In another terminal, run `pnpm test-storybook`. CI builds and serves the
static Storybook before running this command.

Chromatic provides visual regression checks through `pnpm chromatic`. Component tests
check interactions and rendered behavior alongside those visual comparisons.

### End-to-end tests

`pnpm test:e2e` seeds the E2E user, then runs `tests/e2e.test.ts` with Playwright. Prepare a
disposable database first and export `AUTH_SECRET`, `SLACK_TEAM_ID` and the `PG*` connection
settings into the shell so the seed script, session setup and app use the same values.
The session setup also reads `.env`. Keep `.env.local` consistent with those database and
auth settings because the development app reads that file.

```sh
pnpm test:e2e
```

The Playwright configuration starts `pnpm dev` on port 3000, or reuses an existing server
outside CI. The suite uses `http://localhost:3000` and creates a signed-in session for its
test user.

### Static checks and CI

```sh
pnpm lint
pnpm typecheck
```

[GitHub Actions](.github/workflows/ci.yml) defines the current CI checks: lint, TypeScript,
backend tests, and component and Storybook tests when relevant files change.

## Branch strategy

`main` is the production branch; merge development work into `develop`.

For work tracked in Azure Boards, link commits and pull requests with `AB#<task-id>`, for
example `AB#123`. Prefixing a reference with `Fixes` or `Closed` can also transition the
work item. See [Azure Boards linking](https://learn.microsoft.com/en-us/azure/devops/boards/github/link-to-from-github?view=azure-devops).

Branches for Azure DevOps tasks include the task ID, for example
`feat/123-attendance-filter` or `fix/123-status-label`.
