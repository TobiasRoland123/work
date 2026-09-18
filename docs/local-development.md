# Local development

The recommended cross-platform command is:

```bash
pnpm local:dev:docker
```

It reads `.env.local`, refreshes the linked Vercel development credentials, starts the repository's PostgreSQL container, waits for it to become healthy, creates the local `service_role`, synchronizes the development schema with `drizzle-kit push`, and then starts the tunnel and Next.js. It never drops an existing database.

Before the first run:

1. Run `pnpm install`.
2. Copy `.env.example` to `.env.local` and fill in the local Slack and Auth values. The checked-in PostgreSQL values are disposable Docker development defaults.
3. Link this checkout to the `work` Vercel project with `pnpm dlx vercel@59.15.1 link`. The machine-local `.vercel` directory is intentionally ignored by Git.
4. Install Docker and `cloudflared`. Make sure the current user can run `docker compose` without `sudo` and port 3000 is free.
5. Run `pnpm local:dev:docker`.

On Linux, Docker group changes only reach new login sessions. If `getent group docker` lists your username but `id -nG` does not list `docker`, run `newgrp docker` in the current terminal or sign out and back in. Confirm the fix with `docker info`, then rerun the project command. Membership in the Docker group grants root-level access to the machine.

For the existing Mac/Homebrew PostgreSQL setup, use `pnpm local:dev`. That command does not start Docker or change the schema, but it now rejects an incomplete database before Slack login. `pnpm local:db` can explicitly start/synchronize the Docker database without starting the app.

The Docker commands always start Compose before connecting to PostgreSQL. If another PostgreSQL server already owns the configured port, Compose stops with a port-binding error instead of changing that database. `drizzle-kit push` checks the disposable database on every startup and applies schema changes when needed; it asks for confirmation before statements that may lose data.

To deliberately discard the disposable Docker database and rebuild it from the current schema, run `pnpm local:db:reset`. This removes the project-scoped `postgres_data` volume and all data in it. It refuses non-local database hosts. Never use that command for shared or production data.

Do not use `pnpm db:migrate` to initialize a blank database. The historical migration chain starts from an introspected existing schema. Fresh development databases use `drizzle-kit push` through `pnpm local:db`.

The development command checks the local settings and database, refreshes the Vercel development OIDC token when it is missing or expires within 30 minutes, starts a temporary `trycloudflare.com` tunnel, writes only its new value to `AUTH_URL` in `.env.local`, and starts Next.js on `http://127.0.0.1:3000`. It prints these URLs each time:

- `https://<tunnel>/api/auth/callback/slack`
- `https://<tunnel>/api/slack/install/callback`
- `https://<tunnel>/api/slack/events`

In the development Slack app `A0C0YCQHW1J` (`WORK Local Dev`), put the two callback URLs under OAuth & Permissions → Redirect URLs. Put the events URL under Event Subscriptions → Request URL, verify it, and save. A quick tunnel gets a new hostname after restart, so update the app URLs then. Keep the tunnel running while testing Slack login.

Open `https://<tunnel>/login` to sign in and use the app through that address. Starting sign-in on localhost can leave the login cookie on a different host from the Slack callback and cause `InvalidCheck: nonce value could not be parsed`. If this happens, start a fresh sign-in from the tunnel's `/login` page instead of reloading the failed callback.

Slack requires an administrator to approve and install this development app. After installation, save its Bot User OAuth Token as `SLACK_BOT_TOKEN` in `.env.local`, invite the development app to `#wørkbot-test` (`C0BVD3W8N3H`), and restart `pnpm local:dev`. Login and real message delivery still need verification after this step. Do not reuse the production bot token.

There are two Slack apps because each app has one Events Request URL. `WORK 2.0` keeps its production URL on Vercel. `WORK Local Dev` uses the temporary URL on this Mac and separate credentials. Restarting a tunnel or testing development settings therefore does not redirect production events to this computer.

Stop the app with Ctrl+C. The helper stops the tunnel and Next.js child process together. Run `pnpm local:dev` again after changing `.env.local`.

Verified during setup: the local database connection, local login page, signed tunnel challenge, rejection of unsigned events, a synthetic event through the development queue and local consumer, AI Gateway response, credential refresh preserving other settings, and startup/cleanup behavior. The local database was backed up before applying missing 0036/0037 schema changes. Backups and local setup files are in the ignored `.local` directory.

Production deployment, production database, and the `WORK 2.0` Slack configuration were not changed. The production login page responded with HTTP 200 during setup. This was an availability check, not a full production login test.
