# Slack migration

Wørk now uses Slack OpenID for login, Slack's directory for people/photos, and messages from one configured channel for attendance. It never calls `users.profile.set` or changes anyone's Slack status. When attendance extraction cannot set a status, the bot posts a notification in Slack, including for description-only messages and messages left in review. Existing internal user IDs, attendance history, roles and phone relationships are preserved. A unique, case-insensitive email match links an old account to its Slack identity. Conflicts stop that account's import for manual investigation. Directory sync preserves absent/deactivated users and their history, marks previously mapped inactive accounts as deactivated, and hides them from the directory. Active full workspace members can log in; guest, bot, invited and deactivated accounts are excluded.

Profile photos load directly from Slack-hosted URLs in the browser, without the authenticated image proxy or Next.js image optimization. Legacy bucket uploads are no longer supported. Existing bucket URLs display initials until the next directory sync or Slack sign-in replaces them. Missing Slack photos also display initials. No bucket credentials are needed.

## Installation callback repair, 8 September 2026

The administrator installation reached `/api/auth/callback/slack`, which handles OpenID sign-in and cannot exchange a bot installation code. Production also lacked the Slack client ID during that attempt. The handoff reports that client credentials have since been deployed. Installation has not yet been verified.

The dedicated bot flow uses `/api/slack/install` and `/api/slack/install/callback`, with the four bot scopes required for directory lookup, channel history and notifications. The initiation link requires a signature from the deployment operator and expires after 15 minutes. The callback requires a matching signed, ten-minute, HTTP-only browser cookie before calling `oauth.v2.access`, and checks the returned workspace, bot token type and required scopes. It does not create an application login session or return/log the token.

Deployment and installation procedure:

1. Deploy the callback repair. Add `https://work-ivory-six.vercel.app/api/slack/install/callback` to Slack OAuth & Permissions redirect URLs. Keep `https://work-ivory-six.vercel.app/api/auth/callback/slack` for website login. The setup link explicitly selects the installation redirect. Do not resume the old approval link, which may still select the sign-in callback. A direct request to the new callback without an installation cookie is intentionally rejected with restart instructions.
2. Generate a setup link with `SLACK_INSTALL_ENV_FILE=/absolute/path/to/private.env pnpm exec tsx scripts/slack-install-link.ts`. The private file must contain the deployment's `AUTH_URL`, `AUTH_SECRET`, Slack client credentials and `SLACK_TEAM_ID`. Keep the resulting link private and do not save it in logs or tickets. It authorizes starting installation until its 15-minute expiry.
3. Have an approved workspace installer open that link and finish Slack authorization in the same browser within ten minutes. Start from a fresh link after administrator approval, rather than reusing an earlier approval callback or expired code. Slack still enforces its workspace installation policy.
4. On the verified completion page, retrieve the Bot User OAuth Token from the app's OAuth & Permissions page and save it directly as sensitive `SLACK_BOT_TOKEN` in Vercel Production. The callback deliberately leaves token storage with Slack and the deployment operator. Redeploy and verify `auth.test` matches the configured team before testing website sign-in.

Slack also documents a console-managed install for an app's original workspace, which may avoid the custom flow. Approval alone does not prove that installation generated a token. [Slack installation and distribution](https://docs.slack.dev/app-management/distribution/), [bot OAuth](https://docs.slack.dev/authentication/installing-with-oauth/), [OpenID sign-in](https://docs.slack.dev/authentication/sign-in-with-slack/).

Repair deployment `dpl_HdBiFSvazxpByqWidSaaV2wzGcYS` is Ready at the production origin. Both redirect URLs were verified in Slack after reloading OAuth & Permissions. Production checks confirmed HTTP 403 with `no-store` for installation requests without a ticket and callbacks without a matching state cookie; `/api/me` still returns HTTP 401 without sign-in. The actual Slack code exchange and token installation remain untested. Slack still shows “Request to Workspace Install Submitted” and no bot token.

The following saved-settings section is historical and predates the deployment and approval actions recorded in the handoff.

## Required Slack setup

### Saved app settings, verified 8 September 2026

WORK 2.0 now requires these Bot Token Scopes in Slack: `users:read`, `users:read.email`, `channels:history`, and `chat:write`. Existing installations must be reauthorized after adding `chat:write` so the bot can post extraction notifications. User Token Scopes remain empty.

The #wørk channel ID was verified in Slack as `C94UDEF8X`, in workspace `T02HKL21R`.

The user confirmed `https://work-ivory-six.vercel.app` as the intended deployment origin for the new code. The following settings are saved in Slack and were verified after reloading the settings pages:

- Redirect URL: `https://work-ivory-six.vercel.app/api/auth/callback/slack`.
- Event Subscriptions: On, with Request URL `https://work-ivory-six.vercel.app/api/slack/events`.
- Bot event: `message.channels`.
- Socket Mode: Off. It was found enabled and changed to HTTP delivery to match the Vercel implementation.

The event URL is saved but **not verified**. Slack's actual challenge request returned an HTTP error, and the page reports that the URL did not respond correctly. The user confirmed the new Slack code has not been deployed yet, so this is expected. After deployment and server environment configuration, use **Retry** beside the event URL and verify that Slack accepts the challenge. No deployment, Vercel environment changes, installation, or administrator approval request was performed during this setup.

The manifest and environment example use the confirmed origin. Saving these settings does not establish a working Slack connection; installation, bot invitation, deployment configuration, and live tests remain outstanding.

Reuse the existing WORK 2.0 Slack app, ID `A0BVDBKEYBV`, in Charlie Tango workspace `T02HKL21R`. Do not create a duplicate app. The user can create apps but cannot install them in this workspace, so administrator approval is an external prerequisite. No installation or approval request is performed by this repository. The template in `slack-manifest.json` is for updating the existing app using the confirmed Vercel hostname, not for creating another app.

1. Under OAuth & Permissions, add the exact HTTPS redirect URL `https://work-ivory-six.vercel.app/api/auth/callback/slack`. Use an approved HTTPS tunnel or development host for local login testing. Set `AUTH_URL` to that origin.
2. Sign-in requests only `openid profile email`. Do not combine these with bot scopes. Slack requires sign-in and app installation to use separate OAuth flows. The app's `AUTH_SLACK_ID` and `AUTH_SLACK_SECRET` are the Client ID and Client Secret from Basic Information. [Slack OpenID documentation](https://docs.slack.dev/authentication/sign-in-with-slack/)
3. The separate bot installation needs `users:read` and `users:read.email` for names, pictures and email matching, `channels:history` for a public #wørk, and `chat:write` to post notifications when extraction cannot set a status. If #wørk is private, use `groups:history` instead. No `channels:read`, DM scopes or user token scopes are needed for the integration when its channel ID is known. Existing installations must be reauthorized after adding `chat:write`. [Directory scopes](https://docs.slack.dev/reference/methods/users.list/), [message event scopes](https://docs.slack.dev/reference/events/message/)
4. Install through Slack's OAuth & Permissions page and save the resulting Bot User OAuth Token as `SLACK_BOT_TOKEN`. Invite the bot to #wørk. Get the workspace ID and the channel's stable ID from Slack; names and spelling are not used as identifiers.
5. Under Event Subscriptions, set Request URL to `https://work-ivory-six.vercel.app/api/slack/events`. Subscribe to bot event `message.channels`, or `message.groups` for a private channel. Save the Signing Secret from Basic Information as `SLACK_SIGNING_SECRET`. The handler validates signatures, their five-minute age limit, workspace ID and channel ID. [Request verification](https://docs.slack.dev/authentication/verifying-requests-from-slack/), [Events API delivery/retries](https://docs.slack.dev/apis/events-api/)
6. The endpoint must be reachable when Slack validates the URL. No deployment, app installation, credential creation or live Slack connection has been performed as part of this migration.

## Application configuration

Copy `.env.example` to a local environment file and fill actual values. Keep all secrets server-side.

| Variable                                                 | Value                                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------------------- |
| `AUTH_URL`                                               | Application HTTPS origin                                                  |
| `AUTH_SECRET`                                            | New random session secret; rotate at cutover                              |
| `AUTH_SLACK_ID`, `AUTH_SLACK_SECRET`                     | Slack Client ID and Client Secret                                         |
| `SLACK_TEAM_ID`                                          | Charlie Tango workspace ID                                                |
| `SLACK_CHANNEL_ID`                                       | #wørk channel ID                                                          |
| `SLACK_BOT_TOKEN`                                        | Separately installed bot token                                            |
| `SLACK_SIGNING_SECRET`                                   | App Signing Secret                                                        |
| `CRON_SECRET`                                            | Random secret for the scheduled directory sync and manual diagnostic endpoint |
| `AI_GATEWAY_API_KEY`                                         | Vercel AI Gateway API key for attendance extraction                             |
| `SLACK_EXTRACTION_MODEL` | AI Gateway model ID; defaults to `openai/gpt-5.6-luna` |
| `DATABASE_URL`                                           | Production PostgreSQL connection string                                   |
| `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` | Local PostgreSQL connection                                               |

Remove the old `AUTH_MICROSOFT_ENTRA_ID_*` values at cutover. Old Entra sessions cannot access the migrated app. Slack sessions use an eight-hour expiry that Auth.js can renew. Initial sign-in checks live bot directory membership; subsequent server authentication checks the local activity flag. Deactivation takes effect after directory sync, daily by default, and blocks API/server-action/page access while preserving data. Run directory sync immediately when faster revocation is required. `NEXT_PUBLIC_DATABASE_URL` is accepted temporarily for existing deployments; move its value to the server-only `DATABASE_URL` and remove the public variable.

`vercel.json` retains one daily cron for `/api/check-users`. It requires exact `Authorization: Bearer <CRON_SECRET>` and also calls `cleanupExpiredSlackMessages`, so the daily directory sync is the cleanup path when no new Slack messages arrive. Vercel Queues invokes the private `/api/queues/slack-status` consumer; it is not a public cron endpoint. Queue delivery uses Vercel's automatic deployment OIDC configuration, so no queue token is added to this table. The queue feature is available on Vercel Hobby; no plan upgrade is required for this feature. Local and preview environments need their own configured queue/consumer setup or manual diagnostics. See the [Vercel Queues quickstart](https://vercel.com/docs/queues/quickstart) and [SDK reference](https://vercel.com/docs/queues/sdk).

The authenticated `/api/slack/process` endpoint remains available as a manual diagnostic and backlog path. It does not automatically backfill rows that were created before queue publication was introduced. Queue processing handles one message reference at a time, while the database inbox remains the source of truth for retries and terminal state.

## Local Slack login

Local login must start and finish on the same origin. A production `AUTH_URL` in `.env.local` sends the callback to production without the local login cookie and can cause `InvalidCheck: nonce value could not be parsed`.

1. Start `pnpm dev` on port 3000.
2. In another terminal, run `cloudflared tunnel --url http://localhost:3000 --no-autoupdate`. Install it with `brew install cloudflared` on macOS if needed.
3. Set `AUTH_URL` in `.env.local` to the HTTPS origin printed by the tunnel. Add that origin followed by `/api/auth/callback/slack` to the existing Slack app's OAuth redirect URLs and save. Keep the production redirect URLs.
4. Supply `AUTH_SLACK_ID`, `AUTH_SLACK_SECRET`, `AUTH_SECRET`, `SLACK_TEAM_ID` and `SLACK_BOT_TOKEN` locally. The bot token is required for login membership checks as well as attendance import. Vercel cannot export variables marked sensitive; `[SENSITIVE]` is a placeholder, not a usable credential.
5. Configure `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD` and `PGDATABASE` for a separate local database with the current schema. The development database connection uses these values, not the production database URL.
6. Restart the development server, then open `/login` through the HTTPS tunnel URL and begin a fresh sign-in.

Shell-exported `PG*` variables take precedence over `.env.local`. If your shell config points at another database, start with `env -u PGHOST -u PGPORT -u PGUSER -u PGPASSWORD -u PGDATABASE pnpm dev` so Next.js uses this project's local settings.

Keep the tunnel running throughout the session. Quick tunnels receive a new hostname when restarted; update both `AUTH_URL` and the Slack redirect registration when that happens, and remove obsolete development redirects.

The test channel is `C0BVD3W8N3H`. Changing `SLACK_CHANNEL_ID` only changes which received events the app accepts. Slack still delivers events to its configured Event Subscriptions Request URL; a local login tunnel alone does not redirect attendance events or start the inbox processor.

## Database cutover

### Production migration applied, 8 September 2026

After restoring the paused database, production login reached PostgreSQL but failed because `users.slack_user_id` did not exist. Inspection confirmed the legacy schema and no Drizzle migration journal. A full PostgreSQL custom-format backup was created outside the repository and verified by reading the complete archive.

Migrations `0034`, `0035`, and `0036` were applied in order in one transaction. Existing row counts remained unchanged at 71 users and 60 attendance records. Post-commit checks passed for the Slack identity lookup, transaction advisory lock, `AWAY` enum, attendance columns, and inbox RLS. These migrations must not be applied again. No historical migration journal was fabricated. A fresh browser sign-in remains the end-to-end verification step.


Take a database backup and verify which migrations the target has applied. The repository's earliest historical migration is an introspection baseline and cannot initialize a blank database by replaying the complete history.

For an existing database matching the previous schema, apply `db/0034_slack_migration.sql`, `db/0035_slack_precision_and_activity.sql`, then `db/0036_status_announcement_time.sql` once each, in that order using the database's normal migration process. These add Slack identity/interval columns, approximation flags, an activity flag, a timezone-aware announcement timestamp, the AWAY enum value and a private durable inbox. They do not rewrite user IDs, delete data or change existing status values. If the deployment already maintains the Drizzle migration journal, `pnpm db:migrate` is available. Do not replay the entire historical chain against an unjournaled existing database. For a new empty development database, create the existing `service_role` role, then use `pnpm db:push` as documented in the project.

The server database role must own the inbox tables or have the appropriate privileged access; no anonymous/public RLS policy is added for message text. Imported action clocks use the timezone-aware interval bounds; the legacy zone-less `time` column is left empty for imports.

Run `pnpm db:seed` after configuring the bot. It validates the bot workspace, paginates all directory members and reports synced/skipped IDs. Resolve ambiguous email mappings explicitly; do not change primary keys or delete the old accounts. Check unmatched legacy accounts before launch because preserved accounts remain visible.

## Attendance behavior

- Copenhagen dates and daylight saving determine applicability. Date ranges include their last day. Timed intervals include their start and exclude their end.
- The model resolves relative dates from the original Slack message timestamp, including on retries and edits. A clear attendance statement without a date applies to that message's local day.
- WFH, Danish home-working messages, arrival/departure times, temporary absences, explicit office returns and multi-day statements map to Wørk statuses. Exact returns create their own IN_OFFICE interval. AWAY is added because the previous enum had no faithful representation of a temporary absence or explicit work at an unspecified offsite location. Mapping that to sick, leave or client work would invent a reason.
- Missing clock times remain unspecified. Date-only storage boundaries express calendar coverage, not claimed working hours. Ambiguous dates or unsupported intervals require review. When no status fits an attendance message, its full original text is displayed as a description without a status badge on the original Copenhagen message day. The application does not invent a time for "later". The shared Wørk convention treats lunch as 11:00 Copenhagen time: "at lunch" is around 11:00, while "before lunch" and "after lunch" retain their direction in the original comment and use an approximate 11:00 boundary. "Around 10" retains a nominal 10:00 with a per-bound approximation flag, displayed as "ca.". Approximate boundaries use date coverage for applicability and never trigger a definite IN_OFFICE transition at the nominal clock. An approximate arrival remains an expected arrival until a clearer update or date expiry. No arbitrary plus/minus range is invented.
- Multiple applicable announcements use the newest message/edit timestamp. New manual/imported records use the timezone-aware `announced_at`. Historical zone-less `created_at` values are interpreted as Copenhagen wall time; confirm that assumption against the old database timezone before cutover. Future announcements do not hide today's status. An older longer interval can resume when a newer short interval ends. A later manual status overrides an earlier import while it applies.
- Messages with an uncertain status, including greetings, links, activity updates and messages the model considers unrelated, are saved as description-only entries, with a null status and the original message in `details`. They replace earlier entries from the same Slack message and follow the usual latest-announcement selection and deletion rules. When the AI does not set a status, the bot tags the author in the source channel and links to the original message; this includes both description-only entries and messages left in review. Notifications are attempted after the processing result commits. Duplicate deliveries and superseded results do not send notifications. Delivery failures are logged as `slack_notification_failed` and are not retried. Other uncertain messages do not change attendance. Their author sees links under "Check your attendance" on their profile and can set a manual status or clarify the original Slack message. Without an applicable exception, the existing application assumes in-office attendance. An uncertainty flag is not a verified location.
- A valid edit atomically replaces that message's previous intervals. Edits classified as unrelated replace the prior intervals with the original message as a description. Other unclear, failed or malformed edits preserve the last valid intervals until their original expiry. Deletions remove only rows linked to that message. Duplicate/out-of-order delivery cannot overwrite a newer revision. Manual statuses are unaffected by a Slack edit/deletion.
- Live import starts when event subscription is enabled. It does not silently import historical channel messages. Only plain human messages and self-contained replies are processed; bot messages, attachments and unsupported message subtypes are ignored. Replies needing parent context require review.

Product assumptions to confirm before launch: only active full members of the configured workspace can log in; unknown attendance retains the existing in-office default; historical backfill is not automatic; preserved unmatched users remain visible. No parallel Entra authentication is retained.

## Text handling and operations

The queue temporarily stores message text so the worker can retry. Only that one message and its timestamp are sent to the configured OpenAI model, with `store: false`. The AI identifies a nullable comment for each attendance interval, separately from its status and timing. The comment must be a verbatim excerpt from the sender's own explanation, limited to 2000 characters; the server checks that the excerpt occurs in the source message before saving it in the existing status `details` field. For example, "in later, going to dentist" becomes IN_LATE with the comment "going to dentist" and no invented arrival clock. This is AI interpretation, not a split on punctuation. Comments may contain the sender's stated personal reasons and remain with the status history after queue text is cleared. No-comment statuses retain the existing unspecified-time fallback where relevant. A valid edit replaces or removes the comment along with that message's intervals; edits with uncertain status replace it with the full message description; other unclear or invalid edits preserve the previous comment, and explicit deletion removes the source-linked status and comment. Queue text is cleared after success, ignore, review, or five failed attempts. For uncertain-status descriptions, the full original message remains in status `details`. Abandoned pending text is cleared after 24 hours on the next worker run. Database backups and the AI provider's own retention are separate from this application policy; `store: false` does not itself guarantee zero provider retention. [Structured output reference](https://developers.openai.com/api/docs/guides/structured-outputs)

Monitor queue consumer failures, pending backlog/oldest `received_at`, `next_attempt_at`, attempts and review outcomes in `slack_messages`. The daily directory sync also runs cleanup, so cleanup does not depend on a minute processor schedule. Review rows retain only message identifiers and a fixed reason code. A corrected Slack message automatically retries as a new revision. Check the original message in Slack for operational review; queue text is not retained after terminal processing, while description-only entries retain the original message in status `details`.

Required live checks after an authorized installation: sign in as a Charlie Tango user and reject another workspace; compare one photo/name/email; post synthetic WFH/late/return/multi-day messages; edit and delete one; confirm the Wørk view updates within the queue delay plus its 60-second refresh; verify ambiguous wording stays unapplied; confirm Slack status remains unchanged. Live OAuth, permissions and model accuracy require real configuration and have not been verified offline.

The manifest intentionally lists bot scopes only. OpenID scopes are requested by the login flow separately. For a private channel, change the manifest's `channels:history` to `groups:history` and `message.channels` to `message.groups`. The current static bot-token configuration assumes token rotation is disabled; enabling rotation requires a separate refresh-token implementation.


## Current event-triggered processing and AI Gateway, 9 September 2026

Keep Slack Socket Mode off and Event Subscriptions on. The request URL is `https://work-ivory-six.vercel.app/api/slack/events`. For the public test channel, subscribe to the bot event `message.channels`, invite WORK 2.0 to that channel, and set production `SLACK_CHANNEL_ID` to the test channel's ID. The local test configuration uses `C0BVD3W8N3H`; confirm that ID in Slack before configuring production. A verified URL only confirms the challenge handshake. Normal messages must also pass signature, workspace, channel and payload checks.

The event route first commits an accepted event to `slack_messages`, then awaits durable publication to the private `slack-status` Vercel Queue before returning Slack HTTP 200. The published reference contains only `messageKey` and `revision`; raw Slack text stays in the database inbox. The idempotency key is the SHA-256 digest of that reference, so each revision is deduplicated independently. Queue retention is 24 hours. A failed publication returns HTTP 503 so Slack can retry the delivery.

The private queue consumer calls `processQueuedSlackMessage`. Database `nextAttemptAt` and the queue retry callback cooperate: pending work is retried automatically, with a two-minute visibility/claim lease and a 60-second retry delay for unexpected worker failures. Each database job has at most five processing attempts; a fifth failure becomes terminal review and clears the text. Pending text older than 24 hours is cleared on the next worker or daily maintenance run. Invalid queue messages are acknowledged as terminal `invalid_job` diagnostics and are not processed. If a newer Slack revision has replaced a queued one, the older reference cannot apply status rows to the newer revision.

Successful imports and deletions broadcast a UI refresh; the existing 60-second UI polling remains a fallback. The queue consumer has a 60-second maximum duration and the extraction call has a 20-second timeout. The authenticated `/api/slack/process` endpoint is retained for manually processing up to two due backlog rows per request; it is not a scheduled queue replacement and does not backfill pre-queue rows automatically.

Extraction uses Vercel AI SDK with the OpenAI provider pointed at AI Gateway's OpenAI-compatible endpoint, `https://ai-gateway.vercel.sh/v1`. The AI Gateway configuration remains unchanged: set `AI_GATEWAY_API_KEY` as a server-only environment variable in Vercel Production and locally if needed, and use the optional `SLACK_EXTRACTION_MODEL` override (default `openai/gpt-5.6-luna`). Queue authentication uses Vercel's automatic deployed OIDC integration; it does not require a queue token in `.env`. `OPENAI_API_KEY` is no longer used. For local queue testing, refresh the linked project’s OIDC credentials with `vercel env pull` and run `pnpm dev`. Local Queue SDK calls use the real Vercel Queue service. Use a dedicated development database and configuration; do not point local tests at production or copy sensitive values into this guide. Provider/account access and a real extraction remain unverified until a key is configured. Redeploy after setting production environment variables.

Structured output validation, Copenhagen time interpretation, verbatim comment checks, `store: false` and retry limits are unchanged. Missing keys or provider errors do not apply a guessed status. Raw exception bodies and credentials are not logged.

### Verify a message end to end

1. Confirm production `SLACK_TEAM_ID`, `SLACK_CHANNEL_ID` and database target. The old production channel and the test channel have different IDs. Confirm the posting Slack user has a mapped, active Wørk account.
2. Post a fresh attendance message manually in the configured Slack channel.
3. Find `slack_intake` in Vercel runtime logs. It reports `queued`, `duplicate_or_stale`, `deleted`, `review`, or `ignored`. Ignored events include a fixed reason such as `wrong_channel`, `wrong_workspace`, `bot_message`, `unsupported_subtype`, `invalid_event` or `incomplete_message`. `queue_failed` causes HTTP 503 so Slack can retry. No message text or signing credentials are logged.
4. Follow the normalized `messageKey` in `slack_processing` logs and the production `slack_messages` row. Processing logs report the extraction decision or a retry, with fixed failure reasons such as `gateway_key_missing`, `unmapped_user` or `extraction_failed`. Terminal rows clear raw message text. A successful import has `state = applied` and matching status rows with `source_message_key`.
5. Confirm the Today page updates, then verify an edit and deletion. Do not infer successful ingestion from HTTP 200 alone, since ignored events and the URL handshake also return 200.

No API key, live Slack message, production configuration change, deployment or live queue test was performed during this implementation. The key, deployment and an end-to-end queue check are still required.

References: [Slack Events API](https://docs.slack.dev/apis/events-api/), [Vercel Queues quickstart](https://vercel.com/docs/queues/quickstart), [Vercel Queues SDK](https://vercel.com/docs/queues/sdk), [Gateway Chat Completions API](https://vercel.com/docs/ai-gateway/sdks-and-apis/openai-chat-completions), [Gateway API keys](https://vercel.com/docs/ai-gateway/authentication-and-byok/api-keys).

### Historical processing description, superseded

The earlier version of this guide said that `after()` processed each event in the background and that an every-minute `/api/slack/process` cron recovered retries and cleanup. That description is retained for migration history only. The current deployment path is the durable Vercel Queue and database retry flow described above; do not add the old minute cron or rely on `after()` for Slack status processing.

### Common-message rules

`lib/slack/shorthand.ts` supplies both whole-message parsing and the conventions included in the AI extraction instructions. Case, whitespace, trailing punctuation, emoji, and pasted edit markers are normalized for matching. Simple WFH, sick, child-sick, KommuneKredit (`wfkk`), KMD Ballerup, arrival times, supported home-to-office transitions, and WFH for the remainder of the day bypass the AI Gateway. These results still pass the normal extraction validation. The original message timestamp determines the Copenhagen date and remainder-of-day start.

Messages with additional clauses or unsupported wording fall through to AI with the complete original text and the same conventions. Explicit times override the lunch default. Approximate arrivals never confirm office presence. Bare times such as `9:30` remain subject to review because the channel convention has not been confirmed. Client shorthand is preserved verbatim in comments rather than expanded into invented sender wording.
