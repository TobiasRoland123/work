# Slack setup

This guide activates Slack support for the existing WORK 2.0 app. It does not create a Slack app or start an installation flow.

The app already exists:

- App ID: `A0BVDBKEYBV`
- Workspace: Charlie Tango, team ID `T02HKL21R`
- Source channel: `#wørk`

The current user cannot install the app. An administrator must complete the bot installation later.

## What the integration does

Users sign in with Slack through Auth.js. That flow requests the OIDC user scopes `openid`, `profile`, and `email`.

The bot uses a separate installation permission set to read the workspace directory and the configured channel:

- `users:read`
- `users:read.email`
- `channels:read`
- `channels:history`

Do not combine these bot scopes with the OIDC scopes in one OAuth authorization request. Slack documents the two flows separately and rejects mixed scope requests. The app has no custom installation OAuth callback. An administrator installs it from the Slack app dashboard, then stores the resulting `xoxb-...` token on the server.

Private channel support is optional. Add `groups:read` and `groups:history` only if the source channel is private and the bot is added to it. The code rejects shared or externally shared channels, so Slack Connect channels cannot be used as the source.

## Apply the manifest to the existing app

1. Replace `YOUR_PRODUCTION_HOST.example` in [manifest.json](./manifest.json) with the production host.
2. Open Slack API, choose app `A0BVDBKEYBV`, then open **Features > App Manifest**.
3. Paste the JSON from `manifest.json` into the editor and save it.
4. Confirm the redirect URL is the exact HTTPS Auth.js callback:

   `https://YOUR_PRODUCTION_HOST.example/api/auth/callback/slack`

This edits the existing app configuration. It does not create another app and it does not install the bot in a workspace.

Slack references:

- [App manifests](https://api.slack.com/reference/manifests)
- [Sign in with Slack setup](https://api.slack.com/authentication/sign-in-with-slack)
- [Installing with OAuth](https://api.slack.com/authentication/oauth-v2)
- [users.list](https://api.slack.com/methods/users.list)
- [conversations.history](https://api.slack.com/methods/conversations.history)

## Environment

Set these server-side variables before enabling runtime jobs:

```text
AUTH_SLACK_ID=
AUTH_SLACK_SECRET=
AUTH_SECRET=
AUTH_URL=https://YOUR_PRODUCTION_HOST.example
SLACK_BOT_TOKEN=xoxb-...
SLACK_CHANNEL_ID=C...
OPENAI_API_KEY=
OPENAI_MODEL=
```

The application also needs `CRON_SECRET` for the protected maintenance endpoints. `DATABASE_URL` is the preferred database variable. Existing local PostgreSQL fallback variables such as `PGUSER`, `PGPASSWORD`, `PGHOST`, `PGPORT`, and `PGDATABASE` remain supported. The older `NEXT_PUBLIC_DATABASE_URL` name is being migrated away from and must not be used for a server secret.

The integration uses team ID `T02HKL21R` in code. `SLACK_CHANNEL_ID` must be the channel ID for `#wørk`, not its display name. The server verifies the ID, membership, non-shared status, and channel name before reading history. Private channels work only with the optional private-channel scopes and bot membership described above.

`SLACK_OFFSITE_LOCATIONS` is a comma-separated list of approved, non-sensitive labels, for example `Client A, Client B`. If it is empty, the parser uses generic labels. Keep personal reasons out of this variable and out of stored status details. The parser maps home working to `Working from home`, client work to an approved location, and leave to the generic `ON_LEAVE` status.

## Database preparation

Run the directory seed before allowing sign-in:

```sh
pnpm db:migrate
pnpm db:seed
```

`pnpm db:migrate` applies only the additive Slack migration `0034_slack_migration.sql`. It runs transactionally and records its journal marker. Do not replay the older migration chain, which contains inconsistent historical migrations. The migration adds Slack identity, message, and sync tables plus the status source link. It does not delete users or existing status data.

The seed builds the initial Charlie Tango user directory. The Slack directory sync matches a member to an existing account by unique, normalized email, or creates a new account when no match exists. It accepts only verified members of team `T02HKL21R` and excludes bots, app users, guests, deleted users, and invited users. It never moves an identity because an email changed, and it never deletes a user. A member without a usable email is skipped. Login remains refused until an active Slack identity exists, so seed first.

## Administrator activation checklist

An administrator should complete these steps after the manifest is saved:

1. Add the bot scopes from the manifest, and add `groups:read` plus `groups:history` only when `#wørk` is private.
2. Install the existing app in Charlie Tango from the app dashboard.
3. Add the bot to `#wørk` if Slack requires channel membership.
4. Copy the Bot User OAuth Access Token into the server secret store as `SLACK_BOT_TOKEN`.
5. Set `SLACK_CHANNEL_ID` to the ID of `#wørk` and set all required server environment variables.
6. Run `pnpm db:migrate`, then `pnpm db:seed`.
7. Call the protected endpoints manually and inspect the response before scheduling them.

The cron jobs stay disabled until the bot token and channel ID are configured. Configure a schedule externally, or in Vercel, only after the manual checks pass.

## Manual checks and scheduling

Both maintenance endpoints require the same bearer secret and are intended for server-to-server calls:

```sh
curl -i \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://YOUR_PRODUCTION_HOST.example/api/slack/sync

curl -i \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://YOUR_PRODUCTION_HOST.example/api/check-users
```

`/api/slack/sync` verifies the bot token and workspace, refreshes the Slack directory, and reads the bounded channel snapshot. `/api/check-users` refreshes the existing directory from Microsoft Graph. Keep both endpoints server-only. They do not post to Slack and do not write status messages back to Slack.

The Slack history read is a complete, paginated 45-day snapshot. The sync considers top-level messages authored by the matching Slack user. Thread replies are not supported by the bot history permission set. Message fingerprints make edits and repeated runs idempotent. A deleted recent source is removed only after a complete fetch. Edits or deletions older than 45 days are outside the detection window.

The parser sends message text transiently to the configured OpenAI model with `store: false`; raw Slack text is not stored in the database. Model output is filtered for approved statuses, dates, times, and locations. Live model accuracy is not verified, so unknown or uncertain times remain unknown. Office attendance is an assumption used for display and is not proof that someone is present. Dates span inclusively, and times use Copenhagen time by default.

## Tests and rollback

The Slack tests use local mocks. A live Slack or OpenAI end-to-end check is blocked until an administrator supplies installation credentials and the server environment is configured.

If activation must be paused, disable the external schedule and remove or rotate the server-side bot token. The database change is additive. Roll back application code and leave the new tables in place until a reviewed migration is available. Do not run destructive SQL or replay old migrations.
