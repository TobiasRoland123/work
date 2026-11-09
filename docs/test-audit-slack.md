# Slack unit-test audit

Scope: all 302 baseline cases in the 17 files below, including every parameter-table row. All were read against `CONTEXT.md`, `docs/slack-setup.md`, `docs/message-quality.md`, `docs/office-presence.md`, the production modules and their route/UI/inbox callers. No production code changed.

The final run executes 435 cases in 17 files, all passing, with zero skipped cases. This count excludes the three Slack database integration suites. The parent captured their database-backed baseline separately.

## File decisions

| File | Decision | Baseline -> final cases | Purpose, changes and retained protection |
| --- | --- | ---: | --- |
| `tests/backend/lib/slack-image.test.ts` | Improved | 12 -> 17 | Retain every approved host and all original rejection vectors. Add userinfo/host confusion, data and relative URLs. Verify canonicalization of HTTPS host/default port while retaining path and query. |
| `tests/backend/lib/slack.test.ts` | Improved | 11 -> 44 | Retain OIDC subject precedence, verified workspace identity, conflicting mappings, reviewer seed identity, bot-team rejection, pagination, typed errors and stale-session invalidation. Restore every environment/global mock. Strengthen cursor request bodies, bearer headers and error metadata. Add bot success, cursor loops, malformed directories, unavailable retry headers, missing configuration, member eligibility, exact users.info identity, trusted permalinks, legacy email linking and OIDC alternate claims. |
| `tests/backend/lib/slack/text.test.ts` | Improved | 4 -> 6 | Retain readable standard emoji, single-pass entity decoding, aliases/skin tones and custom emoji/clock preservation. Add unsupported entity preservation and custom emoji followed by a tone. Escaping remains the renderer responsibility. |
| `tests/backend/slack/ai-usage-response.test.ts` | Improved | 3 -> 23 | Retain billed Gateway usage, missing/malformed usage and SDK fallback. Add malformed bodies, invalid/nonfinite/negative costs, zero billed usage, unsafe tokens, per-field fallback and response-ID precedence. Market cost never substitutes for billed cost. |
| `tests/backend/slack/ai-usage.test.ts` | Improved | 4 -> 6 | Retain insertion before finish, null unknown cost, unique retries, start-write failure and contained finish-write failure. Assert the exact inserted shape rather than a partial match plus three forbidden fields. Add successful paid completion, no finish before successful start and no second finish. |
| `tests/backend/slack/comments-display.test.ts` | Improved | 17 -> 17 | Retain both unspecified-clock statuses, approximate bounds, escaped sender markup, client-city details, description date anchoring, all excluded review reasons, unrelated-message descriptions, blank rejection, safe description rendering and compact same-year date ranges. Use plausible separate arrival/departure source messages. Assert the exact source link and absent single-day date badge. |
| `tests/backend/slack/context-extraction.test.ts` | Improved | 7 -> 8 | Retain referenced correction, unknown/duplicate/nonreplaceable/uncertain-reference rejection, historical-comment rejection and history confined to user data. Strengthen complete correction equality. Add independent announcements and uncertain review with empty replacement lists. |
| `tests/backend/slack/events.test.ts` | Improved | 14 -> 31 | Retain exact signed-body security, workspace/channel/bot rejection, edit identity, deleted-text removal, replies from all three parent-author classes, retained thread roots and intake diagnostic reasons. Strengthen full edit identity. Add inclusive past/future replay-window boundaries, malformed signing headers, edit event_ts fallback, missing edit/deletion identifiers and missing configuration. |
| `tests/backend/slack/extraction.test.ts` | Improved; duplicate cases removed | 31 -> 36 | Retain explicit mention-only attribution, per-interval recipients, local date anchoring, date-only rows, inclusive multi-day bounds, exact timed transitions, unspecified arrival, all six invalid date/time fixtures, strict fields/overlap rejection, full-message comments and length limits, uncertainty, DST ambiguity, approximation, multi-day AWAY/REMOTE rows and Gateway transport/usage/configuration failures. Replace six duplicate conference parser cases with coverage already present in shorthand.test.ts. Give malformed fixtures distinct names and exact transition instants. Add date-horizon edges, missing approximate clocks, zero duration, oversized intake bypass, failed usage-start bypass and 23/25-hour DST dates. |
| `tests/backend/slack/installation.test.ts` | Improved | 12 -> 37 | Retain valid/tampered/expired setup, callback trust, successful code exchange/token nondisclosure, wrong workspace/missing scope/Slack failure, HTTP failure, signed state and config. Freeze Date.now before execution and use an independent HMAC for tickets. Add cookie/cache security, user/invalid/missing bot token and enterprise rejection, ticket/state lifetime edges, nonce/secret/purpose binding, cancelled/missing-code callbacks, unsafe origins, missing required config and a fixed HMAC vector. |
| `tests/backend/slack/learned-shorthand.test.ts` | Improved | 29 -> 31 | Retain whole-phrase normalization, fixed-parser bypass, all 13 unlearnable phrase classes, empty recipients compatibility, recipient prohibition, relative date rollover, full comments, DST clocks, send-clock/nonapply prohibition, comment mismatch/DST invalidation and all threshold cases. Replace template-vs-template equality with an independent literal expected template. Add exact phrase-length edges and regexp-metacharacter comments. |
| `tests/backend/slack/queue.test.ts` | Improved | 8 -> 17 | Retain reference-only publication, revision idempotency, publication error propagation, strict unknown-field rejection, worker dispatch, pending backoff, safe unexpected-error retry, invalid-job acknowledgement and private-trigger config. Add cross-message idempotency, exact dispatch count, invalid payload bounds and maximum reference length. Limit cron assertion to absence of Slack processing cron instead of freezing unrelated cron configuration. |
| `tests/backend/slack/review-deletion.test.ts` | Improved | 1 -> 1 | Retain the documented deletion without previous_message/sender and assert its complete normalized object, including null author and original message identity. This remains distinct from deletion payloads that contain previous_message. |
| `tests/backend/slack/review-extraction.test.ts` | Improved; duplicate cases removed | 24 -> 24 | Retain bilingual prompt data, source-excerpt expansion in three sentence orders/languages, invalid comments, long comments, approximate output, four unsafe schemas/decisions, refusal/truncation, retryable HTTP failure, AWAY/REMOTE/AT_CLIENT interval preservation, uncertain review, domain instructions and multi-day comment expansion. Rename mocked model tests to describe adapter behavior; correct the final fixture dates to the original local day. Remove duplicate default-model case because extraction.test.ts also checks auth, URL, storage and usage. Replace exact prompt prose with role/source-data checks where it was incidental. Add malformed JSON paid-attempt accounting. |
| `tests/backend/slack/review-routes.test.ts` | Improved | 24 -> 32 | Retain signed intake/configuration, unsigned/stale challenge rejection, signed challenge, malformed JSON/oversized body, enqueue and publication acknowledgement ordering, duplicate recovery, safe diagnostics, committed deletion, nonpublished review/ignore, null payloads, all cron auth variants and manual identity/field stripping/status validation. Expand configuration to each missing key and assert cron response counts. Add multibyte byte-limit behavior, exact maximum body, sanitized cron failure, invalid session providers/missing IDs and malformed manual JSON. |
| `tests/backend/slack/shorthand.test.ts` | Improved; duplicate cases removed | 93 -> 96 | Retain every real parser language/alias/status/date fixture, unsupported-message AI delegation, local midnight, lunch approximation, home-to-office transitions, rest-of-day anchoring, bare-clock adapter and domain instructions. Remove registry-constant equality because all city aliases already run through extractAttendance. Replace conditional arrival expectations with explicit complete intervals and add 09:01. Add invalid minutes/negative hours/shared-mention fallback; assert the delegated review result. |
| `tests/backend/slack/week-cache-invalidation.test.ts` | Improved | 8 -> 9 | Retain first/retried committed imports, failed imports, both deletion-removal outcomes, terminal deletion/applied retries and rolled-back deletion. Repair stale complete extraction mock by preserving real exports, including slackMentionIds, so these cases actually reach commit. Add broadcast failure after commit, which must retain applied success and cache invalidation. |

## Findings

- The two baseline failures were stale mock setup. `week-cache-invalidation.test.ts` replaced the entire extraction module and omitted `slackMentionIds`, which the inbox now calls. Its imports failed before the mocked commit, so the tests never exercised cache invalidation. A partial mock restores the real helpers and both cases now reach commit and broadcast.
- A mocked AI fixture claimed a today/tomorrow interpretation but supplied tomorrow/day-after dates. Its comment-expansion test now uses the actual original Copenhagen date. Synthetic model responses verify adapter validation and preservation; they cannot establish live-model interpretation quality.
- `docs/slack-setup.md` still has older wording about accepting self-contained replies. `CONTEXT.md`, current code and the newer context section exclude every thread reply. Tests follow that domain rule. Product documentation was left unchanged in this test-only task.
- No production behavior bug was confirmed in this scope. No cases are blocked.

## Removed duplicate cases

- Six conference typo/language cases in `extraction.test.ts` repeated real deterministic parser coverage from `shorthand.test.ts`. The retained shorthand table covers those exact six phrases, full intervals/comments and absence of HTTP calls.
- The KMD registry equality case in `shorthand.test.ts` repeated the exported constant. Every listed city and alias remains exercised through the real `extractAttendance` parser, including home-working precedence and unknown-city delegation.
- The optional default-model case in `review-extraction.test.ts` repeated `extraction.test.ts` Gateway transport coverage. The retained case checks the default model together with endpoint, bearer auth, structured schema, storage setting and final usage.

## Verification

The focused command was `pnpm exec vitest run --project backend` followed by the 17 explicit paths in the table, with JSON output `/tmp/work-test-audit/slack-final.json`. It passed 435/435 with zero skips. ESLint passed all 17 files. Type checking is coordinated by the parent because other agents edit the same checkout.

Mutation checks used `/tmp/work-test-audit/slack-mutation.config.ts`. A Vite transform changed one module in memory for each invocation, and the unchanged focused suite first passed with that same temporary config. No production source file was edited. Each mutant exited 1 because behavioral assertions failed, with no collection errors.

| Mutation | Test file | Failed cases | Concrete protection |
| --- | --- | ---: | --- |
| Drop the cursor from subsequent directory requests | `lib/slack.test.ts` | 2 | follows users.list pagination |
| Treat zero billed cost as missing | `slack/ai-usage-response.test.ts` | 1 | preserves free calls and zero tokens as known values |
| Accept a ticket at its exact expiry instant | `slack/installation.test.ts` | 1 | accepts a ticket expiring in 0 milliseconds only within its lifetime |
| Reject a correctly signed request at exactly five minutes of clock skew | `slack/events.test.ts` | 2 | bounds clock skew at -300000 milliseconds |
| Keep the selected excerpt instead of expanding it to the original source message | `slack/review-extraction.test.ts` | 7 | expands a valid mocked comment excerpt to the complete source message for in later, going to dentist |
| Omit invalidation/broadcast after a committed import | `slack/week-cache-invalidation.test.ts` | 3 | invalidates committed imports/edits before broadcast, including retry attempt 0 |

Mutation JSON and logs are in `/tmp/work-test-audit/slack-mutant-*.json` and `.log`. These are deliberately selected behavioral mutations, not an exhaustive mutation score.

## Individual case purposes and decisions

Each line below records one executed case, after expanding all parameter tables. The title states its behavioral purpose. "Retained" means the existing purpose remains protected; file notes above identify strengthened assertions. "Improved or added" covers new boundaries and renamed cases whose old wording overstated mocked AI interpretation or hid the actual invalid input. All baseline cases absent by title are either those renames or the eight duplicate removals documented above.

### `tests/backend/lib/slack-image.test.ts`

- Retained: Slack-only profile photos accepts a Slack photo source: https://avatars.slack-edge.com/team-user.jpg. Verified passing.
- Retained: Slack-only profile photos accepts a Slack photo source: https://secure.gravatar.com/avatar/user.png. Verified passing.
- Retained: Slack-only profile photos accepts a Slack photo source: https://a.slack-edge.com/default-user.png. Verified passing.
- Retained: Slack-only profile photos uses the initials fallback for an unsupported source: null. Verified passing.
- Retained: Slack-only profile photos uses the initials fallback for an unsupported source: undefined. Verified passing.
- Retained: Slack-only profile photos uses the initials fallback for an unsupported source: . Verified passing.
- Retained: Slack-only profile photos uses the initials fallback for an unsupported source: invalid. Verified passing.
- Retained: Slack-only profile photos uses the initials fallback for an unsupported source: https://hel1.your-objectstorage.com/workbucket/profile-images/old.webp. Verified passing.
- Retained: Slack-only profile photos uses the initials fallback for an unsupported source: https://avatars.slack-edge.com.attacker.example/photo.jpg. Verified passing.
- Retained: Slack-only profile photos uses the initials fallback for an unsupported source: http://avatars.slack-edge.com/photo.jpg. Verified passing.
- Retained: Slack-only profile photos uses the initials fallback for an unsupported source: https://user:password@avatars.slack-edge.com/photo.jpg. Verified passing.
- Retained: Slack-only profile photos uses the initials fallback for an unsupported source: https://avatars.slack-edge.com:8443/photo.jpg. Verified passing.
- Improved or added: Slack-only profile photos uses the initials fallback for an unsupported source: https://attacker.example@avatars.slack-edge.com/photo.jpg. Verified passing.
- Improved or added: Slack-only profile photos uses the initials fallback for an unsupported source: https://avatars.slack-edge.com@attacker.example/photo.jpg. Verified passing.
- Improved or added: Slack-only profile photos uses the initials fallback for an unsupported source: data:image/png;base64,aGVsbG8=. Verified passing.
- Improved or added: Slack-only profile photos uses the initials fallback for an unsupported source: //avatars.slack-edge.com/photo.jpg. Verified passing.
- Improved or added: normalizes a trusted URL while preserving its requested image path and query. Verified passing.

### `tests/backend/lib/slack.test.ts`

- Retained: Slack identity guards accepts namespaced OIDC claims and preserves the OIDC subject. Verified passing.
- Retained: Slack identity guards rejects untrusted or incomplete profile 0. Verified passing.
- Retained: Slack identity guards rejects untrusted or incomplete profile 1. Verified passing.
- Retained: Slack identity guards rejects untrusted or incomplete profile 2. Verified passing.
- Retained: Slack identity guards reuses a matching identity and rejects ambiguous or conflicting mappings. Verified passing.
- Retained: initial message reviewer matches only the approved Slack team and user IDs. Verified passing.
- Retained: Slack client validates bot workspace and rejects mismatch. Verified passing.
- Retained: Slack client follows users.list pagination. Verified passing.
- Retained: Slack client exposes typed rate limits. Verified passing.
- Retained: Slack client rejects Slack error bodies even with HTTP 200. Verified passing.
- Retained: invalidates stale non-Slack sessions in the edge config. Verified passing.
- Improved or added: Slack client failure and identity boundaries accepts a bot only in the configured workspace. Verified passing.
- Improved or added: Slack client failure and identity boundaries stops repeated cursors rather than returning a truncated directory or looping. Verified passing.
- Improved or added: Slack client failure and identity boundaries rejects malformed directory members null. Verified passing.
- Improved or added: Slack client failure and identity boundaries rejects malformed directory members {}. Verified passing.
- Improved or added: Slack client failure and identity boundaries rejects malformed directory members "members". Verified passing.
- Improved or added: Slack client failure and identity boundaries defaults an unavailable Retry-After null to sixty seconds. Verified passing.
- Improved or added: Slack client failure and identity boundaries defaults an unavailable Retry-After "invalid" to sixty seconds. Verified passing.
- Improved or added: Slack client failure and identity boundaries fails before requesting Slack when the bot token is missing. Verified passing.
- Improved or added: Slack client failure and identity boundaries excludes an ineligible directory member {"deleted":true}. Verified passing.
- Improved or added: Slack client failure and identity boundaries excludes an ineligible directory member {"is_bot":true}. Verified passing.
- Improved or added: Slack client failure and identity boundaries excludes an ineligible directory member {"is_restricted":true}. Verified passing.
- Improved or added: Slack client failure and identity boundaries excludes an ineligible directory member {"is_ultra_restricted":true}. Verified passing.
- Improved or added: Slack client failure and identity boundaries excludes an ineligible directory member {"is_invited_user":true}. Verified passing.
- Improved or added: Slack client failure and identity boundaries excludes an ineligible directory member {"id":"USLACKBOT"}. Verified passing.
- Improved or added: Slack client failure and identity boundaries excludes an ineligible directory member {"team_id":"T-other"}. Verified passing.
- Improved or added: Slack client failure and identity boundaries excludes an ineligible directory member {}. Verified passing.
- Improved or added: Slack client failure and identity boundaries keeps an ordinary active workspace member eligible. Verified passing.
- Improved or added: Slack client failure and identity boundaries fetches the requested user and refuses a different identity in the response. Verified passing.
- Improved or added: Slack client failure and identity boundaries returns only a trusted Slack permalink https://workspace.slack.com/archives/C1/p123. Verified passing.
- Improved or added: Slack client failure and identity boundaries returns only a trusted Slack permalink https://slack.com.attacker.example/archives/C1/p123. Verified passing.
- Improved or added: Slack client failure and identity boundaries returns only a trusted Slack permalink http://workspace.slack.com/archives/C1/p123. Verified passing.
- Improved or added: Slack client failure and identity boundaries returns only a trusted Slack permalink https://user:secret@workspace.slack.com/archives/C1/p123. Verified passing.
- Improved or added: Slack client failure and identity boundaries returns only a trusted Slack permalink https://workspace.slack.com:8443/archives/C1/p123. Verified passing.
- Improved or added: Slack identity mapping boundaries returns no mapping for a new identity and preserves the local ID for an unlinked email. Verified passing.
- Improved or added: Slack identity mapping boundaries rejects duplicate Slack identity. Verified passing.
- Improved or added: Slack identity mapping boundaries rejects changed Slack email. Verified passing.
- Improved or added: Slack identity mapping boundaries rejects different Slack user. Verified passing.
- Improved or added: Slack identity mapping boundaries rejects different Slack team. Verified passing.
- Improved or added: Slack identity mapping boundaries rejects a missing OIDC email null. Verified passing.
- Improved or added: Slack identity mapping boundaries rejects a missing OIDC email "". Verified passing.
- Improved or added: Slack identity mapping boundaries rejects a missing OIDC email " ". Verified passing.
- Improved or added: Slack identity mapping boundaries rejects a missing OIDC email undefined. Verified passing.
- Improved or added: Slack identity mapping boundaries uses alternate Slack claims when the OIDC subject is absent. Verified passing.

### `tests/backend/lib/slack/text.test.ts`

- Retained: Slack message text for display shows emoji and characters instead of Slack markup. Verified passing.
- Retained: Slack message text for display decodes every entity Slack escapes, exactly once. Verified passing.
- Retained: Slack message text for display supports aliases, emoji-style symbols and skin tones. Verified passing.
- Retained: Slack message text for display keeps custom workspace emoji and ordinary colons untouched. Verified passing.
- Improved or added: keeps unsupported entities and HTML as text for the rendering layer to escape. Verified passing.
- Improved or added: preserves unknown custom emoji with a tone and adjacent punctuation. Verified passing.

### `tests/backend/slack/ai-usage-response.test.ts`

- Retained: AI Gateway usage response parser reads Gateway cost, token counts, and generation ID from the OpenAI response body. Verified passing.
- Retained: AI Gateway usage response parser does not invent cost when Gateway cost is missing or malformed. Verified passing.
- Retained: AI Gateway usage response parser uses normalized AI SDK token counts when raw Gateway counts are absent. Verified passing.
- Improved or added: Gateway usage trust boundaries tolerates an absent or malformed response null. Verified passing.
- Improved or added: Gateway usage trust boundaries tolerates an absent or malformed response undefined. Verified passing.
- Improved or added: Gateway usage trust boundaries tolerates an absent or malformed response %j. Verified passing.
- Improved or added: Gateway usage trust boundaries tolerates an absent or malformed response "invalid". Verified passing.
- Improved or added: Gateway usage trust boundaries tolerates an absent or malformed response 1. Verified passing.
- Improved or added: Gateway usage trust boundaries never estimates a malformed billed cost -1 from market cost. Verified passing.
- Improved or added: Gateway usage trust boundaries never estimates a malformed billed cost Infinity from market cost. Verified passing.
- Improved or added: Gateway usage trust boundaries never estimates a malformed billed cost NaN from market cost. Verified passing.
- Improved or added: Gateway usage trust boundaries never estimates a malformed billed cost 0.25 from market cost. Verified passing.
- Improved or added: Gateway usage trust boundaries never estimates a malformed billed cost null from market cost. Verified passing.
- Improved or added: Gateway usage trust boundaries preserves free calls and zero tokens as known values. Verified passing.
- Improved or added: Gateway usage trust boundaries rejects unsafe raw token count -1. Verified passing.
- Improved or added: Gateway usage trust boundaries rejects unsafe raw token count 0.5. Verified passing.
- Improved or added: Gateway usage trust boundaries rejects unsafe raw token count Infinity. Verified passing.
- Improved or added: Gateway usage trust boundaries rejects unsafe raw token count 9007199254740992. Verified passing.
- Improved or added: Gateway usage trust boundaries rejects unsafe raw token count 12. Verified passing.
- Improved or added: Gateway usage trust boundaries prefers raw token counts individually and falls back only for invalid fields. Verified passing.
- Improved or added: Gateway usage trust boundaries selects the first usable response identifier 0. Verified passing.
- Improved or added: Gateway usage trust boundaries selects the first usable response identifier 1. Verified passing.
- Improved or added: Gateway usage trust boundaries selects the first usable response identifier 2. Verified passing.

### `tests/backend/slack/ai-usage.test.ts`

- Retained: Slack AI usage recorder inserts an attempt before completion and leaves unknown cost as null. Verified passing.
- Retained: Slack AI usage recorder blocks the AI call if the starting row cannot be stored. Verified passing.
- Retained: Slack AI usage recorder creates a separate row for each paid attempt of the same message revision. Verified passing.
- Retained: Slack AI usage recorder keeps the started row when final usage cannot be stored. Verified passing.
- Improved or added: Slack usage recorder lifecycle refuses completion before a successful start. Verified passing.
- Improved or added: Slack usage recorder lifecycle stores known final usage once and consumes the attempt. Verified passing.

### `tests/backend/slack/comments-display.test.ts`

- Retained: sender comment display shows a comment without inventing a midnight action for IN_LATE. Verified passing.
- Retained: sender comment display shows a comment without inventing a midnight action for LEAVING_EARLY. Verified passing.
- Retained: sender comment display keeps approximate timing separate from comment wording. Verified passing.
- Retained: sender comment display escapes sender-provided markup instead of rendering it. Verified passing.
- Retained: sender comment display shows the identified KMD office/city in attendance details for AT_CLIENT. Verified passing.
- Retained: unclassified attendance descriptions preserves the full message and uses the original Copenhagen day. Verified passing.
- Retained: unclassified attendance descriptions leaves uncertain_date in review. Verified passing.
- Retained: unclassified attendance descriptions leaves uncertain_time in review. Verified passing.
- Retained: unclassified attendance descriptions leaves other_person in review. Verified passing.
- Retained: unclassified attendance descriptions leaves conflicting in review. Verified passing.
- Retained: unclassified attendance descriptions leaves unsupported in review. Verified passing.
- Retained: unclassified attendance descriptions displays a message even when the model calls it unrelated: Playing VECTIDE: Ride the waveform rest of the day. Verified passing.
- Retained: unclassified attendance descriptions displays a message even when the model calls it unrelated: hello. Verified passing.
- Retained: unclassified attendance descriptions displays a message even when the model calls it unrelated: https://work-ivory-six.vercel.app/today. Verified passing.
- Retained: unclassified attendance descriptions does not display empty messages. Verified passing.
- Retained: unclassified attendance descriptions renders the message safely without a status badge or date badge. Verified passing.
- Retained: unclassified attendance descriptions renders multi-day status date range without year when start and end share the same year. Verified passing.

### `tests/backend/slack/context-extraction.test.ts`

- Retained: contextual attendance extraction accepts a referenced arrival correction while retaining the prior target date. Verified passing.
- Retained: contextual attendance extraction rejects unknown reference. Verified passing.
- Retained: contextual attendance extraction rejects duplicate reference. Verified passing.
- Retained: contextual attendance extraction rejects multi-day target. Verified passing.
- Retained: contextual attendance extraction rejects uncertain correction. Verified passing.
- Retained: contextual attendance extraction does not allow copying historical text into the new comment. Verified passing.
- Retained: contextual attendance extraction sends history as user data and bypasses bare-clock shorthand when context exists. Verified passing.
- Improved or added: allows an independent announcement or uncertain review without replacing history. Verified passing.

### `tests/backend/slack/events.test.ts`

- Retained: Slack event security and normalization verifies exact signed body and rejects tampering, stale requests and missing configuration. Verified passing.
- Retained: Slack event security and normalization ignores other workspaces, channels and bots. Verified passing.
- Retained: Slack event security and normalization keys edits to their original message and orders by edit timestamp. Verified passing.
- Retained: Slack event security and normalization normalizes deletions without retaining their old text. Verified passing.
- Retained: Slack thread replies ignores replies to someone else, including their edits. Verified passing.
- Retained: Slack thread replies ignores replies to yourself, including their edits. Verified passing.
- Retained: Slack thread replies ignores replies to an unknown author, including their edits. Verified passing.
- Retained: Slack thread replies keeps thread parents. Verified passing.
- Retained: Slack intake diagnostics reports wrong_workspace without returning the rejected payload. Verified passing.
- Retained: Slack intake diagnostics reports wrong_channel without returning the rejected payload. Verified passing.
- Retained: Slack intake diagnostics reports bot_message without returning the rejected payload. Verified passing.
- Retained: Slack intake diagnostics reports unsupported_subtype without returning the rejected payload. Verified passing.
- Retained: Slack intake diagnostics reports incomplete_message without returning the rejected payload. Verified passing.
- Retained: Slack intake diagnostics reports invalid_event without returning the rejected payload. Verified passing.
- Improved or added: Slack signature replay window bounds clock skew at -300001 milliseconds. Verified passing.
- Improved or added: Slack signature replay window bounds clock skew at -300000 milliseconds. Verified passing.
- Improved or added: Slack signature replay window bounds clock skew at 300000 milliseconds. Verified passing.
- Improved or added: Slack signature replay window bounds clock skew at 300001 milliseconds. Verified passing.
- Improved or added: Slack signature replay window rejects malformed signing headers 0 without throwing. Verified passing.
- Improved or added: Slack signature replay window rejects malformed signing headers 1 without throwing. Verified passing.
- Improved or added: Slack signature replay window rejects malformed signing headers 2 without throwing. Verified passing.
- Improved or added: Slack signature replay window rejects malformed signing headers 3 without throwing. Verified passing.
- Improved or added: Slack signature replay window rejects malformed signing headers 4 without throwing. Verified passing.
- Improved or added: Slack signature replay window rejects malformed signing headers 5 without throwing. Verified passing.
- Improved or added: Slack edit and deletion revision fallbacks uses event_ts for an edit without edited.ts while preserving original message identity. Verified passing.
- Improved or added: Slack edit and deletion revision fallbacks does not invent missing edit/deletion identifiers 0. Verified passing.
- Improved or added: Slack edit and deletion revision fallbacks does not invent missing edit/deletion identifiers 1. Verified passing.
- Improved or added: Slack edit and deletion revision fallbacks does not invent missing edit/deletion identifiers 2. Verified passing.
- Improved or added: Slack edit and deletion revision fallbacks does not invent missing edit/deletion identifiers 3. Verified passing.
- Improved or added: Slack edit and deletion revision fallbacks fails closed without workspace/channel configuration 0. Verified passing.
- Improved or added: Slack edit and deletion revision fallbacks fails closed without workspace/channel configuration 1. Verified passing.

### `tests/backend/slack/extraction.test.ts`

- Retained: attendance extraction boundary accepts only explicit Slack mentions and deduplicates shared attendance recipients. Verified passing.
- Retained: attendance extraction boundary keeps recipient assignments on their own intervals and preserves old extraction input. Verified passing.
- Retained: attendance extraction boundary uses Copenhagen day across UTC midnight. Verified passing.
- Retained: attendance extraction boundary represents WFH dates without manufacturing action times or retaining reasons. Verified passing.
- Retained: attendance extraction boundary keeps multi-day final dates inclusive through the last evening. Verified passing.
- Retained: attendance extraction boundary supports precise arrival, departure and return intervals. Verified passing.
- Retained: attendance extraction boundary preserves unspecified arrival time. Verified passing.
- Improved or added: attendance extraction boundary rejects nonexistent calendar date. Verified passing.
- Improved or added: attendance extraction boundary rejects reversed dates. Verified passing.
- Improved or added: attendance extraction boundary rejects reversed clocks. Verified passing.
- Improved or added: attendance extraction boundary rejects invalid clock. Verified passing.
- Improved or added: attendance extraction boundary rejects date beyond the supported horizon. Verified passing.
- Improved or added: attendance extraction boundary rejects clock on a multi-day interval. Verified passing.
- Retained: attendance extraction boundary rejects invented free-text fields and overlapping intervals. Verified passing.
- Retained: attendance extraction boundary uses the complete original message for every non-null comment and preserves null comments. Verified passing.
- Retained: attendance extraction boundary accepts a full comment up to 12000 characters and rejects longer comments. Verified passing.
- Retained: attendance extraction boundary cannot apply uncertain output. Verified passing.
- Retained: attendance extraction boundary rejects repeated/nonexistent Danish daylight-saving clock times. Verified passing.
- Retained: preserves approximate nominal arrival without turning it into definite office presence. Verified passing.
- Retained: multi-day out-of-office status extraction maps multi-day date intervals with statusRows covering today through tomorrow inclusive. Verified passing.
- Retained: multi-day out-of-office status extraction maps multi-day REMOTE intervals with statusRows and details preserved. Verified passing.
- Retained: AI Gateway transport does not create an AI attempt for deterministic shorthand. Verified passing.
- Retained: AI Gateway transport uses the Gateway URL, bearer key, provider-qualified default model, and disables storage. Verified passing.
- Retained: AI Gateway transport fails clearly when the Gateway key is missing. Verified passing.
- Retained: AI Gateway transport records a failed model call without estimating its cost. Verified passing.
- Improved or added: extraction intake and clock boundaries bounds supported dates at 2026-08-07. Verified passing.
- Improved or added: extraction intake and clock boundaries bounds supported dates at 2026-08-06. Verified passing.
- Improved or added: extraction intake and clock boundaries bounds supported dates at 2027-09-08. Verified passing.
- Improved or added: extraction intake and clock boundaries bounds supported dates at 2027-09-09. Verified passing.
- Improved or added: extraction intake and clock boundaries rejects missing approximate clocks or zero duration 0. Verified passing.
- Improved or added: extraction intake and clock boundaries rejects missing approximate clocks or zero duration 1. Verified passing.
- Improved or added: extraction intake and clock boundaries rejects missing approximate clocks or zero duration 2. Verified passing.
- Improved or added: extraction intake and clock boundaries returns oversized input to review without calling the model or recording paid usage. Verified passing.
- Improved or added: extraction intake and clock boundaries does not call the model if storing the attempt fails. Verified passing.
- Improved or added: extraction intake and clock boundaries uses the full Copenhagen calendar day on DST transition 2026-03-29. Verified passing.
- Improved or added: extraction intake and clock boundaries uses the full Copenhagen calendar day on DST transition 2026-10-25. Verified passing.

### `tests/backend/slack/installation.test.ts`

- Retained: Slack installation setup route accepts only a valid setup ticket. Verified passing.
- Retained: Slack installation setup route accepts only a tampered setup ticket. Verified passing.
- Retained: Slack installation setup route accepts only a expired setup ticket. Verified passing.
- Retained: Slack installation callback route rejects an untrusted callback before fetching Slack. Verified passing.
- Retained: Slack installation callback route rejects a tampered state before fetching Slack. Verified passing.
- Retained: Slack installation callback route rejects a expired state before fetching Slack. Verified passing.
- Retained: Slack installation callback route exchanges a valid code with the exact callback and clears the cookie without returning the token. Verified passing.
- Retained: Slack installation callback route rejects wrong team and clears the cookie. Verified passing.
- Retained: Slack installation callback route rejects missing scope and clears the cookie. Verified passing.
- Retained: Slack installation callback route rejects Slack failure and clears the cookie. Verified passing.
- Improved or added: Slack installation callback route rejects user token and clears the cookie. Verified passing.
- Improved or added: Slack installation callback route rejects invalid bot token and clears the cookie. Verified passing.
- Improved or added: Slack installation callback route rejects missing token and clears the cookie. Verified passing.
- Improved or added: Slack installation callback route rejects enterprise install and clears the cookie. Verified passing.
- Retained: Slack installation callback route handles Slack HTTP failures and clears the cookie. Verified passing.
- Retained: installation state and configuration creates and validates a state cookie, while rejecting tampering and expiry. Verified passing.
- Improved or added: installation trust and time boundaries accepts a ticket expiring in -1 milliseconds only within its lifetime. Verified passing.
- Improved or added: installation trust and time boundaries accepts a ticket expiring in 0 milliseconds only within its lifetime. Verified passing.
- Improved or added: installation trust and time boundaries accepts a ticket expiring in 1 milliseconds only within its lifetime. Verified passing.
- Improved or added: installation trust and time boundaries accepts a ticket expiring in 900000 milliseconds only within its lifetime. Verified passing.
- Improved or added: installation trust and time boundaries accepts a ticket expiring in 900001 milliseconds only within its lifetime. Verified passing.
- Improved or added: installation trust and time boundaries binds a state cookie to its nonce, signing purpose and secret. Verified passing.
- Improved or added: installation trust and time boundaries bounds signed state expiry at -1 milliseconds. Verified passing.
- Improved or added: installation trust and time boundaries bounds signed state expiry at 0 milliseconds. Verified passing.
- Improved or added: installation trust and time boundaries bounds signed state expiry at 1 milliseconds. Verified passing.
- Improved or added: installation trust and time boundaries bounds signed state expiry at 600000 milliseconds. Verified passing.
- Improved or added: installation trust and time boundaries bounds signed state expiry at 600001 milliseconds. Verified passing.
- Improved or added: installation trust and time boundaries clears a verified session without calling Slack for query "error=access_denied". Verified passing.
- Improved or added: installation trust and time boundaries clears a verified session without calling Slack for query "". Verified passing.
- Improved or added: installation trust and time boundaries rejects an unsafe installation origin http://work.example. Verified passing.
- Improved or added: installation trust and time boundaries rejects an unsafe installation origin https://user:password@work.example. Verified passing.
- Improved or added: installation trust and time boundaries fails closed without AUTH_URL. Verified passing.
- Improved or added: installation trust and time boundaries fails closed without AUTH_SECRET. Verified passing.
- Improved or added: installation trust and time boundaries fails closed without AUTH_SLACK_ID. Verified passing.
- Improved or added: installation trust and time boundaries fails closed without AUTH_SLACK_SECRET. Verified passing.
- Improved or added: installation trust and time boundaries fails closed without SLACK_TEAM_ID. Verified passing.
- Improved or added: signs the purpose and value with the installation secret. Verified passing.

### `tests/backend/slack/learned-shorthand.test.ts`

- Retained: learningPhrase normalizes the whole message. Verified passing.
- Retained: learningPhrase leaves phrases the fixed parser handles to that parser. Verified passing.
- Retained: learningPhrase does not learn a phrase with a weekday. Verified passing.
- Retained: learningPhrase does not learn a phrase with a Danish weekday. Verified passing.
- Retained: learningPhrase does not learn a phrase with a month. Verified passing.
- Retained: learningPhrase does not learn a phrase with a week. Verified passing.
- Retained: learningPhrase does not learn a phrase with a numeric date. Verified passing.
- Retained: learningPhrase does not learn a phrase with a Danish date. Verified passing.
- Retained: learningPhrase does not learn a phrase with the moment of sending. Verified passing.
- Retained: learningPhrase does not learn a phrase with negation. Verified passing.
- Retained: learningPhrase does not learn a phrase with Danish negation. Verified passing.
- Retained: learningPhrase does not learn a phrase with a contraction. Verified passing.
- Retained: learningPhrase does not learn a phrase with a question. Verified passing.
- Retained: learningPhrase does not learn a phrase with a shared attendance mention. Verified passing.
- Retained: learningPhrase does not learn a phrase with a long message. Verified passing.
- Retained: learned templates keeps empty recipient lists compatible with existing learned templates. Verified passing.
- Retained: learned templates never stores a recipient assignment in a reusable template. Verified passing.
- Retained: learned templates stores days relative to the message and resolves them from each new message. Verified passing.
- Retained: learned templates round trips the complete learned source message as its comment. Verified passing.
- Retained: learned templates keeps clocks across a daylight saving change. Verified passing.
- Retained: learned templates does not learn a clock read from the moment of sending. Verified passing.
- Retained: learned templates falls through when the comment is not in the new message or the result is invalid. Verified passing.
- Retained: learningThreshold reads undefined as null. Verified passing.
- Retained: learningThreshold reads "" as null. Verified passing.
- Retained: learningThreshold reads "0" as null. Verified passing.
- Retained: learningThreshold reads "2.5" as null. Verified passing.
- Retained: learningThreshold reads "three" as null. Verified passing.
- Retained: learningThreshold reads "1" as 1. Verified passing.
- Retained: learningThreshold reads " 4 " as 4. Verified passing.
- Improved or added: learns exactly the allowed whole-message length and rejects longer phrases. Verified passing.
- Improved or added: escapes regexp characters when matching learned comments. Verified passing.

### `tests/backend/slack/queue.test.ts`

- Retained: Slack queue publication publishes references only and deduplicates per message revision. Verified passing.
- Retained: Slack queue publication propagates publication failure so Slack delivery can retry. Verified passing.
- Retained: Slack queue publication refuses unexpected data such as raw message text. Verified passing.
- Retained: Slack queue consumer processes the referenced revision and permits acknowledgement on completion. Verified passing.
- Retained: Slack queue consumer reschedules pending jobs using the database backoff instead of acknowledging. Verified passing.
- Retained: Slack queue consumer retries unexpected failures without leaking provider or database errors. Verified passing.
- Retained: Slack queue consumer acknowledges malformed jobs without processing or logging their contents. Verified passing.
- Retained: Slack queue consumer registers a private queue trigger and removes the status-processing cron. Verified passing.
- Improved or added: Slack queue payload bounds refuses malformed publication and acknowledges malformed consumption 0. Verified passing.
- Improved or added: Slack queue payload bounds refuses malformed publication and acknowledges malformed consumption 1. Verified passing.
- Improved or added: Slack queue payload bounds refuses malformed publication and acknowledges malformed consumption 2. Verified passing.
- Improved or added: Slack queue payload bounds refuses malformed publication and acknowledges malformed consumption 3. Verified passing.
- Improved or added: Slack queue payload bounds refuses malformed publication and acknowledges malformed consumption 4. Verified passing.
- Improved or added: Slack queue payload bounds refuses malformed publication and acknowledges malformed consumption 5. Verified passing.
- Improved or added: Slack queue payload bounds refuses malformed publication and acknowledges malformed consumption 6. Verified passing.
- Improved or added: Slack queue payload bounds refuses malformed publication and acknowledges malformed consumption 7. Verified passing.
- Improved or added: Slack queue payload bounds allows the maximum reference length without copying unknown data. Verified passing.

### `tests/backend/slack/review-deletion.test.ts`

- Retained: documented Slack deletion payload normalizes a deletion without optional previous_message or sender data. Verified passing.

### `tests/backend/slack/review-extraction.test.ts`

- Improved or added: attendance AI adapter with mocked structured replies sends the original Copenhagen date and source text to the adapter for WFH tomorrow. Verified passing.
- Improved or added: attendance AI adapter with mocked structured replies sends the original Copenhagen date and source text to the adapter for Jeg arbejder hjemme i morgen. Verified passing.
- Improved or added: attendance AI adapter with mocked structured replies expands a valid mocked comment excerpt to the complete source message for in later, going to dentist. Verified passing.
- Improved or added: attendance AI adapter with mocked structured replies expands a valid mocked comment excerpt to the complete source message for Tandlægebesøg først, så jeg kommer senere. Verified passing.
- Improved or added: attendance AI adapter with mocked structured replies expands a valid mocked comment excerpt to the complete source message for going to dentist so I will be in later. Verified passing.
- Retained: attendance AI adapter with mocked structured replies rejects an invented, empty or oversized comment 0. Verified passing.
- Retained: attendance AI adapter with mocked structured replies rejects an invented, empty or oversized comment 1. Verified passing.
- Retained: attendance AI adapter with mocked structured replies rejects an invented, empty or oversized comment 2. Verified passing.
- Retained: attendance AI adapter with mocked structured replies accepts a source comment above 2000 characters up to the 12000-character limit. Verified passing.
- Retained: attendance AI adapter with mocked structured replies retains a nominal approximate time from valid structured output. Verified passing.
- Retained: attendance AI adapter with mocked structured replies does not apply invalid or unsafe model output 0. Verified passing.
- Retained: attendance AI adapter with mocked structured replies does not apply invalid or unsafe model output 1. Verified passing.
- Retained: attendance AI adapter with mocked structured replies does not apply invalid or unsafe model output 2. Verified passing.
- Retained: attendance AI adapter with mocked structured replies does not apply invalid or unsafe model output 3. Verified passing.
- Retained: attendance AI adapter with mocked structured replies rejects incomplete or refused responses 0. Verified passing.
- Retained: attendance AI adapter with mocked structured replies rejects incomplete or refused responses 1. Verified passing.
- Retained: attendance AI adapter with mocked structured replies leaves transport failures retryable instead of interpreting them as no status. Verified passing.
- Improved or added: attendance AI adapter with mocked structured replies preserves a mocked multi-day AWAY interval without inventing details. Verified passing.
- Improved or added: attendance AI adapter with mocked structured replies preserves a mocked multi-day REMOTE interval and expands its source comment. Verified passing.
- Improved or added: attendance AI adapter with mocked structured replies preserves a mocked multi-day AT_CLIENT interval and expands its source comment. Verified passing.
- Improved or added: attendance AI adapter with mocked structured replies preserves an uncertain mocked reply rather than manufacturing a status. Verified passing.
- Retained: attendance AI adapter with mocked structured replies includes conference and multi-day date instructions in the prompt sent to the AI. Verified passing.
- Retained: attendance AI adapter with mocked structured replies normalizes a valid model excerpt to the complete multi-day source message. Verified passing.
- Improved or added: returns review for a malformed JSON model answer while recording the completed paid attempt. Verified passing.

### `tests/backend/slack/review-routes.test.ts`

- Improved or added: Slack HTTP authentication boundaries requires SLACK_SIGNING_SECRET and fails closed. Verified passing.
- Improved or added: Slack HTTP authentication boundaries requires SLACK_TEAM_ID and fails closed. Verified passing.
- Improved or added: Slack HTTP authentication boundaries requires SLACK_CHANNEL_ID and fails closed. Verified passing.
- Retained: Slack HTTP authentication boundaries rejects unsigned challenge requests before returning the challenge. Verified passing.
- Retained: Slack HTTP authentication boundaries answers only a valid signed challenge without queue work. Verified passing.
- Retained: Slack HTTP authentication boundaries rejects stale signatures. Verified passing.
- Retained: Slack HTTP authentication boundaries rejects malformed signed JSON. Verified passing.
- Retained: Slack HTTP authentication boundaries bounds a body even without Content-Length. Verified passing.
- Retained: Slack HTTP authentication boundaries does not acknowledge a failed durable enqueue. Verified passing.
- Retained: Slack HTTP authentication boundaries acknowledges only after the queue write resolves, without processing AI inline. Verified passing.
- Retained: Slack HTTP authentication boundaries waits for publication of the exact committed message before acknowledging. Verified passing.
- Retained: Slack HTTP authentication boundaries republishes a duplicate delivery after the first publication fails. Verified passing.
- Retained: Slack HTTP authentication boundaries logs channel rejection without starting the worker or exposing the message. Verified passing.
- Retained: Slack HTTP authentication boundaries publishes a committed deletion without invoking the inbox worker. Verified passing.
- Retained: Slack HTTP authentication boundaries returns 503 for publication failures without exposing event text. Verified passing.
- Retained: Slack HTTP authentication boundaries does not publish review intake outcomes. Verified passing.
- Retained: Slack HTTP authentication boundaries does not publish ignored intake outcomes. Verified passing.
- Retained: Slack HTTP authentication boundaries ignores signed null payloads without crashing. Verified passing.
- Retained: Slack HTTP authentication boundaries rejects invalid cron authorization undefined. Verified passing.
- Retained: Slack HTTP authentication boundaries rejects invalid cron authorization Bearer wrong. Verified passing.
- Retained: Slack HTTP authentication boundaries rejects invalid cron authorization synthetic-cron-secret. Verified passing.
- Retained: Slack HTTP authentication boundaries never accepts an empty cron secret. Verified passing.
- Retained: Slack HTTP authentication boundaries processes a valid authenticated cron request. Verified passing.
- Retained: manual attendance identity boundary rejects missing login. Verified passing.
- Retained: manual attendance identity boundary uses the session user and strips imported attribution from supplied fields. Verified passing.
- Retained: manual attendance identity boundary rejects unsupported statuses before writing. Verified passing.
- Improved or added: Slack HTTP failure responses limits UTF-8 bytes rather than JavaScript characters. Verified passing.
- Improved or added: Slack HTTP failure responses accepts a signed body at the exact byte limit and passes the parsed payload to intake. Verified passing.
- Improved or added: Slack HTTP failure responses returns a retryable cron failure without returning database exception details. Verified passing.
- Improved or added: Slack HTTP failure responses refuses an invalid manual-status session 0. Verified passing.
- Improved or added: Slack HTTP failure responses refuses an invalid manual-status session 1. Verified passing.
- Improved or added: Slack HTTP failure responses refuses malformed manual-status JSON before writing. Verified passing.

### `tests/backend/slack/shorthand.test.ts`

- Retained: common Slack shorthand resolves wfh without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves   WFH   without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves   :house:   WfH   (edited)   without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves wfkk without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves sick without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves still sick without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves child sick without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves KMD Ballerup without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves KMD Odense without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves KMD Aalborg without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves KMD Aarhus without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves KMD Århus without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves KMD Warszawa without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves KMD Warsaw without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves Ballerup without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves Odense without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves Aalborg without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves Ålborg without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves Aarhus without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves Århus without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves Warszawa without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves Warsaw without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves at conference without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves på konference without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves til konference without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves offsite without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves remote without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves working remotely without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves working remote today without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves arbejder remote i dag without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves Working remotely today, not from home without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves Working from Roskilde today without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves WF KMD Aalborg ✈️ without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves Working from Aalborg today without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves In Aalborg today without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves I Århus i dag without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves Working in Warsaw today without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves Working from home today without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves Working from home in Aalborg without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves WFH in Aarhus today without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves remote pattern "working remotely today and tomorrow" without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves remote pattern "working remote today and tomorow" without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves remote pattern "arbejder remote i dag og i morgen" without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves remote pattern "Working from Roskilde today and tomorrow" without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves remote pattern "working remotely tomorrow" without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves KMD office/city pattern "In Ballerup tomorrow" to AT_CLIENT with preserved details. Verified passing.
- Retained: common Slack shorthand resolves KMD office/city pattern "In Odense tomorrow" to AT_CLIENT with preserved details. Verified passing.
- Retained: common Slack shorthand resolves KMD office/city pattern "Working from Aarhus tomorrow" to AT_CLIENT with preserved details. Verified passing.
- Retained: common Slack shorthand resolves KMD office/city pattern "In Århus today and tomorrow" to AT_CLIENT with preserved details. Verified passing.
- Retained: common Slack shorthand resolves KMD office/city pattern "KMD Warszawa today and tomorrow" to AT_CLIENT with preserved details. Verified passing.
- Retained: common Slack shorthand resolves KMD office/city pattern "Working from Warsaw tomorrow" to AT_CLIENT with preserved details. Verified passing.
- Retained: common Slack shorthand resolves KMD office/city pattern "I Odense i dag og i morgen" to AT_CLIENT with preserved details. Verified passing.
- Retained: common Slack shorthand resolves conference pattern "at conference today and tomorrow" without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves conference pattern "at conference today and tomorow" without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves conference pattern "At conference today and tomorow" without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves conference pattern "  :stadium:  at conference today and tomorow  " without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves conference pattern "på konference i dag og i morgen" without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves conference pattern "til konference i dag og i morgen" without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves conference pattern "today and tomorrow at conference" without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves conference pattern "at conference tomorrow" without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves conference pattern "at conference tomorow" without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves conference pattern "til konference i morgen" without an AI configuration. Verified passing.
- Retained: common Slack shorthand resolves conference pattern "at conference today" without an AI configuration. Verified passing.
- Improved or added: common Slack shorthand uses the workday boundary for an explicit arrival In at 7. Verified passing.
- Improved or added: common Slack shorthand uses the workday boundary for an explicit arrival In at 9. Verified passing.
- Improved or added: common Slack shorthand uses the workday boundary for an explicit arrival In at 09:01. Verified passing.
- Improved or added: common Slack shorthand uses the workday boundary for an explicit arrival In at 10. Verified passing.
- Improved or added: common Slack shorthand uses the workday boundary for an explicit arrival In 9.45. Verified passing.
- Improved or added: common Slack shorthand uses the workday boundary for an explicit arrival in the office at 10.30. Verified passing.
- Retained: common Slack shorthand preserves the home-to-office transition in Wfh, In at 10:00. Verified passing.
- Retained: common Slack shorthand preserves the home-to-office transition in Starting from home, in at 10. Verified passing.
- Retained: common Slack shorthand sends the complete unsupported message wfh tomorrow to AI. Verified passing.
- Retained: common Slack shorthand sends the complete unsupported message not wfh to AI. Verified passing.
- Retained: common Slack shorthand sends the complete unsupported message not in the office to AI. Verified passing.
- Retained: common Slack shorthand sends the complete unsupported message not in the office today to AI. Verified passing.
- Retained: common Slack shorthand sends the complete unsupported message not in Aalborg today to AI. Verified passing.
- Retained: common Slack shorthand sends the complete unsupported message ikke i Aarhus i dag to AI. Verified passing.
- Retained: common Slack shorthand sends the complete unsupported message Vacation in Warsaw this week to AI. Verified passing.
- Retained: common Slack shorthand sends the complete unsupported message Anyone in Odense today? to AI. Verified passing.
- Retained: common Slack shorthand sends the complete unsupported message In Ballerup today? to AI. Verified passing.
- Retained: common Slack shorthand sends the complete unsupported message Daniel is in Aalborg today to AI. Verified passing.
- Retained: common Slack shorthand sends the complete unsupported message In Roskilde today to AI. Verified passing.
- Retained: common Slack shorthand sends the complete unsupported message wfh with child sick to AI. Verified passing.
- Retained: common Slack shorthand sends the complete unsupported message wfh, hope to come in later to AI. Verified passing.
- Retained: common Slack shorthand sends the complete unsupported message in at 25:00 to AI. Verified passing.
- Retained: common Slack shorthand sends the complete unsupported message wfh? to AI. Verified passing.
- Improved or added: common Slack shorthand sends the complete unsupported message in at 10:60 to AI. Verified passing.
- Improved or added: common Slack shorthand sends the complete unsupported message In at -1 to AI. Verified passing.
- Improved or added: common Slack shorthand sends the complete unsupported message Working from home with <@U123> to AI. Verified passing.
- Retained: common Slack shorthand uses the Copenhagen calendar day across UTC midnight. Verified passing.
- Retained: common Slack shorthand maps lunch arrival to an approximate 11:00 late arrival. Verified passing.
- Retained: common Slack shorthand keeps the before/after lunch qualification in the comment for starting at home, in before lunch. Verified passing.
- Retained: common Slack shorthand keeps the before/after lunch qualification in the comment for wfh, at the office after lunch. Verified passing.
- Retained: common Slack shorthand anchors WFH rest of day to the original Copenhagen message time. Verified passing.
- Retained: common Slack shorthand passes a bare clock to AI and accepts its office-arrival interpretation. Verified passing.
- Retained: common Slack shorthand gives the AI the same KommuneKredit, KMD office cities, and lunch shorthand rules. Verified passing.

### `tests/backend/slack/week-cache-invalidation.test.ts`

- Retained: Slack board cache invalidation invalidates committed imports/edits before broadcast, including retry attempt 0. Verified passing.
- Retained: Slack board cache invalidation invalidates committed imports/edits before broadcast, including retry attempt 2. Verified passing.
- Improved or added: Slack board cache invalidation keeps a committed import successful when realtime broadcast fails. Verified passing.
- Retained: Slack board cache invalidation does not invalidate or broadcast an import whose transaction failed. Verified passing.
- Retained: Slack board cache invalidation invalidates only accepted deletions that removed statuses: true. Verified passing.
- Retained: Slack board cache invalidation invalidates only accepted deletions that removed statuses: false. Verified passing.
- Retained: Slack board cache invalidation invalidates and broadcasts terminal deleted queue retries. Verified passing.
- Retained: Slack board cache invalidation invalidates and broadcasts terminal applied queue retries. Verified passing.
- Retained: Slack board cache invalidation does not invalidate a rolled back deletion. Verified passing.
