# Local development

`pnpm local:dev` starts the app against the existing Homebrew PostgreSQL 18 instance at `127.0.0.1:5432`, database `work_dev`. It does not start Docker, run migrations, seed Slack users, or change a production database.

Before the first run:

This Mac is already configured. The following steps are for recreating the setup; do not overwrite the existing `.env.local`.

1. Copy `.env.example` to `.env.local` and keep the local database values pointed at `127.0.0.1:5432/work_dev`.
2. Fill in the local Slack and Auth values. Keep `SLACK_BOT_TOKEN` empty until an administrator installs the development bot, if it is still pending.
3. If queue testing needs Vercel development credentials, run `pnpm local:credentials`. It pulls into `.env.vercel-development` and merges only a valid development `VERCEL_OIDC_TOKEN` into `.env.local`, preserving the existing PG, Slack, Auth, and AI values. Both files are chmod 600. Do not pull directly into `.env.local`.
4. Make sure PostgreSQL is running and port 3000 is free.

The command checks the local settings and database, refreshes the Vercel development OIDC token when it is missing or expires within 30 minutes, starts a temporary `trycloudflare.com` tunnel, writes only its new value to `AUTH_URL` in `.env.local`, and starts Next.js on `http://127.0.0.1:3000`. It prints these URLs each time:

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
