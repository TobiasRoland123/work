# Local development

Local development runs against the **Local Sandbox** instead of Slack. The sandbox is an
in-app page at `/sandbox`, reachable without signing in, where you compose messages on
behalf of seeded Sandbox Profiles and watch them flow through the real intake
(`enqueueSlackEvent` → `processQueuedSlackMessage`) in process. Nothing contacts Slack, no
tunnel is needed, and no Vercel project link is needed. The decision is recorded in
[ADR 0001](adr/0001-local-sandbox-replaces-slack.md); the vocabulary (Author, Signed-in
Profile, Sandbox Profile, Sandbox Message) is in [CONTEXT.md](../CONTEXT.md).

The recommended cross-platform command is:

```bash
pnpm local:dev:docker
```

It reads `.env.local`, starts the repository's PostgreSQL container, waits for it to become
healthy, creates the local `service_role`, synchronizes the schema with `drizzle-kit push`,
seeds the checked-in Sandbox Profiles, and starts Next.js on `http://127.0.0.1:3000`. It
never drops an existing database.

## First run

1. Run `pnpm install`.
2. Copy `.env.example` to `.env.local`. Set `AUTH_SECRET` (any long random string) and
   `AI_GATEWAY_API_KEY`. Keep `SLACK_TEAM_ID=T_LOCAL` and `SLACK_CHANNEL_ID=C_LOCAL`: the
   sandbox only accepts those ids, and the start script refuses a real workspace id. The
   checked-in PostgreSQL values are disposable Docker development defaults.
3. Install Docker. Make sure the current user can run `docker compose` without `sudo` and
   port 3000 is free.
4. Run `pnpm local:dev:docker` and open `http://127.0.0.1:3000/sandbox`.

For an existing Mac/Homebrew PostgreSQL setup, use `pnpm local:dev`. It does not start
Docker or change the schema, but rejects an incomplete database. `pnpm local:db` starts and
synchronizes the Docker database without starting the app; `pnpm local:db:reset` discards
the disposable Docker volume and rebuilds it. `pnpm sandbox:seed` re-seeds the fixture
profiles on its own.

On Linux, Docker group changes only reach new login sessions. If `getent group docker`
lists your username but `id -nG` does not list `docker`, run `newgrp docker` in the current
terminal or sign out and back in, then rerun the project command.

Do not use `pnpm db:migrate` to initialize a blank database. The historical migration
chain starts from an introspected existing schema; fresh development databases use
`drizzle-kit push` through `pnpm local:db`.

## Gating

`NODE_ENV !== 'production'` is the only switch (`lib/sandbox/enabled.ts`). There is no
`LOCAL_SANDBOX` flag, so a plain `pnpm dev` also exposes the sandbox. The database host
guard in `scripts/local-dev.mjs` and the `T_LOCAL` scoping described below are what keep
that safe. A production build never registers the sandbox sign-in provider, never lets
`/sandbox` through middleware without a session, and answers `/sandbox` with 404;
`tests/backend/sandbox/` asserts each of those under `NODE_ENV=production`.

## Using the sandbox

**Author vs Signed-in Profile.** Every Sandbox Message is attributed to an Author chosen in
the compose form. Signing in as a profile is separate and only changes whose `/profile`
and manual status form the browser shows. You can stage Declarations for the whole office
without signing in as anyone.

**Fixture profiles** (`lib/sandbox/profiles.ts`, seeded under team `T_LOCAL` with no
avatars):

- Anna Attendee: plain attendee, English.
- Mads Madsen: writes in Danish.
- Freja Hjemme: seeded with a `FROM_HOME` Declaration for today.
- Dag Deaktiveret: `slackDeactivated`, so his messages end in `unmapped_user` and signing
  in as him is refused.
- "Unmapped Slack user": an Author with no profile at all, for the `unmapped_user` retry
  branch.

Ad-hoc profiles can be added on the page. Sample messages, including one in Slack wire
format (`&amp;`, `<@U…>`, `<url|label>`, which nothing unescapes), are one click away.

**Result panel.** After sending you see the intake outcome (`queued`,
`duplicate_or_stale`, …), the processing outcome (terminal state and reason, or "retry
scheduled in N s" with the likely reason, which is a normal inbox outcome rather than a
crash), whether the deterministic shorthand parser or the model handled the text, and the
committed interpretation: decision, reason and every interval with both approximation
flags. The interpretation is reconstructed from the committed `status` rows because the
inbox does not persist raw model output. A missing `AI_GATEWAY_API_KEY` is reported up
front instead of through five retries into `review`.

**Announcement instant.** The optional "Announced at" field is a Europe/Copenhagen wall
clock and sets the Slack `ts`. Backdating a message also backdates the Declaration's
`announcedAt`, so today's Resolved Status ignores it for today; look at the announced day.
The resolver's own clock is not adjustable; live transitions can be watched for real
because the dashboard polls every 15 seconds. Without Supabase there is no broadcast, so
expect up to 15 seconds of lag.

**Channel view.** Messages you typed are kept per Author in the browser's `localStorage`
only, because the inbox nulls message text on every terminal outcome. Edit and Delete send
real `message_changed` and `message_deleted` envelopes; a stale edit surfaces as
`duplicate_or_stale`. "Clear list" forgets the browser list without touching data.

**Reset.** Deletes `status` rows of `T_LOCAL` profiles and `slack_messages` rows of team
`T_LOCAL`, then clears the browser list. Profiles are kept. Both deletes are scoped and
`tests/backend/sandbox/reset.test.ts` asserts the generated SQL.

## What the sandbox does not exercise

HMAC signature verification, the Vercel Queue round trip, Slack OAuth sign-in,
`listSlackUsers` directory sync, and Slack's real wire text. Changes to
`lib/slack/{events,signature,client,identity}.ts`, `auth.config.ts`, or the queue
configuration must be verified on the preview deployment before merging. The preview
environment has its own database and its own Slack app credentials; see
[Slack setup](slack-setup.md).

Stop the app with Ctrl+C. Run `pnpm local:dev` again after changing `.env.local`.
