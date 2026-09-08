# Slack migration

Wørk now uses Slack OpenID for login, Slack's directory for people/photos, and messages from one configured channel for attendance. It never calls `users.profile.set`, posts messages, or changes anyone's Slack status. Existing internal user IDs, attendance history, roles and phone relationships are preserved. A unique, case-insensitive email match links an old account to its Slack identity. Conflicts stop that account's import for manual investigation. Directory sync preserves absent/deactivated users and their history, marks previously mapped inactive accounts as deactivated, and hides them from the directory. Active full workspace members can log in; guest, bot, invited and deactivated accounts are excluded.

## Required Slack setup

### Saved app settings, verified 8 September 2026

WORK 2.0 now has these required Bot Token Scopes saved in Slack: `users:read`, `users:read.email`, and `channels:history`. The saved scopes were verified by reopening the OAuth & Permissions page. User Token Scopes remain empty. No installation or administrator approval request was submitted.

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
3. The separate bot installation needs `users:read` and `users:read.email` for names, pictures and email matching, plus `channels:history` for a public #wørk. If #wørk is private, use `groups:history` instead. No write scopes, `channels:read`, DM scopes or user token scopes are needed for the integration when its channel ID is known. [Directory scopes](https://docs.slack.dev/reference/methods/users.list/), [message event scopes](https://docs.slack.dev/reference/events/message/)
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
| `CRON_SECRET`                                            | Random secret for both scheduled endpoints                                |
| `OPENAI_API_KEY`                                         | API key for the attendance extraction service                             |
| `SLACK_EXTRACTION_MODEL` | Configurable OpenAI API model supporting strict structured output |
| `DATABASE_URL`                                           | Production PostgreSQL connection string                                   |
| `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` | Local PostgreSQL connection                                               |

Remove the old `AUTH_MICROSOFT_ENTRA_ID_*` values at cutover. Old Entra sessions cannot access the migrated app. Slack sessions use an eight-hour expiry that Auth.js can renew. Initial sign-in checks live bot directory membership; subsequent server authentication checks the local activity flag. Deactivation takes effect after directory sync, daily by default, and blocks API/server-action/page access while preserving data. Run directory sync immediately when faster revocation is required. `NEXT_PUBLIC_DATABASE_URL` is accepted temporarily for existing deployments; move its value to the server-only `DATABASE_URL` and remove the public variable.

`vercel.json` schedules directory sync daily and inbox processing every minute. Both endpoints require exact `Authorization: Bearer <CRON_SECRET>` and reject a missing secret. A cron header alone does not authorize a call. The minute schedule needs a Vercel plan that supports it; Hobby's daily frequency is insufficient. An external authenticated scheduler can call `/api/slack/process` every minute instead. Vercel cron runs in production, so development and preview environments need a scheduler or manual calls. [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)

The worker processes up to two messages per invocation with a two-minute claim lease and 20-second AI timeout. Concurrent invocations safely claim different messages. If traffic routinely exceeds two messages per minute, schedule more worker invocations or raise the batch and function timeout together. A backlog delays application and must be monitored.

## Database cutover

Take a database backup and verify which migrations the target has applied. The repository's earliest historical migration is an introspection baseline and cannot initialize a blank database by replaying the complete history.

For an existing database matching the previous schema, apply `db/0034_slack_migration.sql`, `db/0035_slack_precision_and_activity.sql`, then `db/0036_status_announcement_time.sql` once each, in that order using the database's normal migration process. These add Slack identity/interval columns, approximation flags, an activity flag, a timezone-aware announcement timestamp, the AWAY enum value and a private durable inbox. They do not rewrite user IDs, delete data or change existing status values. If the deployment already maintains the Drizzle migration journal, `pnpm db:migrate` is available. Do not replay the entire historical chain against an unjournaled existing database. For a new empty development database, create the existing `service_role` role, then use `pnpm db:push` as documented in the project.

The server database role must own the inbox tables or have the appropriate privileged access; no anonymous/public RLS policy is added for message text. Imported action clocks use the timezone-aware interval bounds; the legacy zone-less `time` column is left empty for imports.

Run `pnpm db:seed` after configuring the bot. It validates the bot workspace, paginates all directory members and reports synced/skipped IDs. Resolve ambiguous email mappings explicitly; do not change primary keys or delete the old accounts. Check unmatched legacy accounts before launch because preserved accounts remain visible.

## Attendance behavior

- Copenhagen dates and daylight saving determine applicability. Date ranges include their last day. Timed intervals include their start and exclude their end.
- The model resolves relative dates from the original Slack message timestamp, including on retries and edits. A clear attendance statement without a date applies to that message's local day.
- WFH, Danish home-working messages, arrival/departure times, temporary absences, explicit office returns and multi-day statements map to Wørk statuses. Exact returns create their own IN_OFFICE interval. AWAY is added because the previous enum had no faithful representation of a temporary absence or explicit work at an unspecified offsite location. Mapping that to sick, leave or client work would invent a reason.
- Missing clock times remain unspecified. Date-only storage boundaries express calendar coverage, not claimed working hours. Ambiguous dates/statuses or unsupported intervals require review. The application does not invent a time for "later" or "after lunch". "Around 10" retains a nominal 10:00 with a per-bound approximation flag, displayed as "ca.". Approximate boundaries use date coverage for applicability and never trigger a definite IN_OFFICE transition at the nominal clock. An approximate arrival remains an expected arrival until a clearer update or date expiry. No arbitrary plus/minus range is invented.
- Multiple applicable announcements use the newest message/edit timestamp. New manual/imported records use the timezone-aware `announced_at`. Historical zone-less `created_at` values are interpreted as Copenhagen wall time; confirm that assumption against the old database timezone before cutover. Future announcements do not hide today's status. An older longer interval can resume when a newer short interval ends. A later manual status overrides an earlier import while it applies.
- Uncertain messages do not change attendance. Their author sees links under "Check your attendance" on their profile and can set a manual status or clarify the original Slack message. Without an applicable exception, the existing application assumes in-office attendance. An uncertainty flag is not a verified location.
- A valid edit atomically replaces that message's previous intervals. Unclear, ignored, failed or malformed edits preserve the last valid intervals until their original expiry. Deletions remove only rows linked to that message. Duplicate/out-of-order delivery cannot overwrite a newer revision. Manual statuses are unaffected by a Slack edit/deletion.
- Live import starts when event subscription is enabled. It does not silently import historical channel messages. Only plain human messages and self-contained replies are processed; bot messages, attachments and unsupported message subtypes are ignored. Replies needing parent context require review.

Product assumptions to confirm before launch: only active full members of the configured workspace can log in; unknown attendance retains the existing in-office default; historical backfill is not automatic; preserved unmatched users remain visible. No parallel Entra authentication is retained.

## Text handling and operations

The queue temporarily stores message text so the worker can retry. Only that one message and its timestamp are sent to the configured OpenAI model, with `store: false`. The AI identifies a nullable comment for each attendance interval, separately from its status and timing. The comment must be a verbatim excerpt from the sender's own explanation, limited to 2000 characters; the server checks that the excerpt occurs in the source message before saving it in the existing status `details` field. For example, "in later, going to dentist" becomes IN_LATE with the comment "going to dentist" and no invented arrival clock. This is AI interpretation, not a split on punctuation. Comments may contain the sender's stated personal reasons and remain with the status history after queue text is cleared. No-comment statuses retain the existing unspecified-time fallback where relevant. A valid edit replaces or removes the comment along with that message's intervals; unclear or invalid edits preserve the previous comment, and explicit deletion removes the source-linked status and comment. Raw text is cleared after success, ignore, review, or five failed attempts. Abandoned pending text is cleared after 24 hours on the next worker run. Database backups and the AI provider's own retention are separate from this application policy; `store: false` does not itself guarantee zero provider retention. [Structured output reference](https://developers.openai.com/api/docs/guides/structured-outputs)

Monitor `/api/slack/process` failures, pending backlog/oldest `received_at`, attempts and review outcomes in `slack_messages`. A stopped scheduler also stops cleanup. Review rows retain only message identifiers and a fixed reason code. A corrected Slack message automatically retries as a new revision. Check the original message in Slack for operational review; raw text is not retained after terminal processing.

Required live checks after an authorized installation: sign in as a Charlie Tango user and reject another workspace; compare one photo/name/email; post synthetic WFH/late/return/multi-day messages; edit and delete one; confirm the Wørk view updates within the queue delay plus its 60-second refresh; verify ambiguous wording stays unapplied; confirm Slack status remains unchanged. Live OAuth, permissions and model accuracy require real configuration and have not been verified offline.

The manifest intentionally lists bot scopes only. OpenID scopes are requested by the login flow separately. For a private channel, change the manifest's `channels:history` to `groups:history` and `message.channels` to `message.groups`. The current static bot-token configuration assumes token rotation is disabled; enabling rotation requires a separate refresh-token implementation.


## AI SDK and model configuration

Extraction uses Vercel AI SDK `generateText` with `Output.object` and the OpenAI provider's Chat Completions model. The Zod schema validates the structured output; additional validation checks dates, intervals, certainty, and comment source wording. The provider receives `store: false`. SDK retries are disabled because the durable inbox already handles retries, and each extraction retains its 20-second timeout. See [structured output](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data) and the [OpenAI provider](https://ai-sdk.dev/providers/ai-sdk-providers/openai).

`.env.example` contains `SLACK_EXTRACTION_MODEL=gpt-5.6-luna` as the user's requested placeholder. It is not a verified available OpenAI API model. Codex model availability does not establish OpenAI API availability. Verify the model ID and account access before live use and replace this setting if needed. The runtime has no fallback model. No actual model setting was configured in this checkout's environment or local environment files during the follow-up; changing the example alone does not configure the running application.
