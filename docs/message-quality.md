# Message quality review

`/message-quality` shows accepted Slack messages that did not produce a saved attendance status. It also shows the conversion rate for the most recent 12 Copenhagen calendar weeks. This is an operational review of import outcomes, not a measure of model accuracy. For example, a message saved only as a description has no attendance status and appears in the review list even though its text was stored elsewhere.

Each week starts on Monday in `Europe/Copenhagen`, based on the original Slack message time, and ends on Sunday. The rate is the number of accepted, nondeleted messages whose latest revision produced at least one non-null saved status divided by all accepted, nondeleted messages in that week. Pending messages remain in the denominator and appear as a separate count. An empty week displays `N/A`. An edit replaces the previous revision for this count; it does not add another message. The review list excludes pending, deleted and converted messages. A historical terminal row with no recorded outcome appears as `Not recorded`, separate from known unconverted messages. The date filter opens older weeks beyond the initial 12-week view.

AI cost appears on the weekly tiles and as a seven-day breakdown for the selected week. These dates are the recorded processing/request start dates in Copenhagen, independent of the original message week used for conversion. Calls from retries, edits and deleted messages are included. The recorder uses the raw `usage.cost` value reported by AI Gateway; it does not look up model prices or estimate missing costs. Calls without a reported cost are counted as unpriced and make a partial total incomplete. Costs are shown to four decimal places, with smaller positive amounts displayed as `<$0.0001 USD`. This tracking begins when the feature is deployed; it does not reconstruct costs for earlier calls.

The list shows the author, original message time, original text when retained, processing outcome, reason, attempt count and processing time. Technical details include the message key, revision and receipt time. Review text is retained up to 12,000 characters. The migration backfills an older message's original text when its exact latest description-only status still contains that text. Other older records may say the raw text is unavailable because the inbox cleared it before this feature existed. An uncertain edit can leave an older valid status in place, so the card describes what the current revision created. The page cannot correct or label a message; investigate the original Slack post and its saved status separately.

## Access

In real workspaces, an authenticated Slack session alone does not grant review access. The server checks the live `users.can_review_messages` flag, an active Slack identity and `SLACK_TEAM_ID` for every request. The review service performs the same check before reading inbox data. People without access see neither the navigation link nor the page. There is no public review API. The flag is not editable through profile or user-update actions.

The initial reviewer is Tobias Roland, identified by Slack team `T02HKL21R`, Slack user `U05NP1NF3QB` and email `tru@charlietango.dk`. The migration grants his existing mapped account, and the Slack identity import grants him when it first creates his account in another environment. Later sign-ins and directory syncs preserve the stored flag, so an explicit revocation remains effective. Other real accounts start without review access unless an operator grants it.

In the local sandbox workspace, all active mapped sandbox accounts can review messages. This exception requires both a nonproduction build and `SLACK_TEAM_ID=T_LOCAL`. A production or preview build still needs the database grant, even if its team setting were accidentally `T_LOCAL`. A development build pointed at a real workspace also needs the grant.

Apply the database migration before using this feature. To select a reviewer, first find their exact internal `users.user_id` in the intended database and confirm their Slack mapping. Then run one of these commands with the target environment's database configuration:

```sh
pnpm message-review:access grant <exact-user-id>
pnpm message-review:access revoke <exact-user-id>
```

The command changes only the exact internal user ID. Granting fails if the user is deactivated, has no Slack user ID or belongs to a different configured team. Both commands read the row back and print the resulting permission and identity so the operator can verify the target. There are no automatic database grants for other real accounts, including admins. Local sandbox access follows the exception above. For production, run with `NODE_ENV=production`, the production `DATABASE_URL` and the matching `SLACK_TEAM_ID` set in the operator's private environment. Do not paste the connection string into a shared command log.

Revocation takes effect on the next server request in a real workspace. The page uses server rendering and does not expose inbox rows through client data requests. Real workspace access is available in each environment only to accounts explicitly granted in that environment's database.
