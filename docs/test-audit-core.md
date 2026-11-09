# Core unit-test audit

Reviewed against `CONTEXT.md`, `docs/office-presence.md`, `docs/access-control.md`, `docs/local-development.md`, `docs/pwa.md` and sandbox-auth ADR 0002. Read the corresponding production modules and their page/action/service callers before changing tests. No production behavior changed.

This audit covers all 25 originally assigned files and the new PostgreSQL replacement file. Every expanded case appears below, including each parameterized row. Retaining a test means its assertions still detect a plausible caller-visible regression; it does not mean the case needed a cosmetic rewrite.

## File decisions

| File under tests/backend | Decision | Rationale |
| --- | --- | --- |
| `className.test.ts` | Improved | Real wrapper output is its public contract. Added nested arrays and object flags, and verified that unrelated and hover classes survive a spacing conflict. |
| `userHelper.test.ts` | Improved | Expanded grouped examples into individually named email cases, including plus aliases, deceptive suffixes, subdomains, empty local parts and spaces. The helper currently has no production caller; tests retain its exported validation contract without inventing case-normalization behavior. |
| `auth/roles.test.ts` | Improved | Stored role and admin behavior remain explicit. Replaced partial SQL fragments and unordered parameter containment with the complete membership predicate and bound values. Restored the workspace environment after every case. Renamed the uncached-call case to avoid claiming it proves request boundaries; the real-render test now proves those boundaries. |
| `lib/auth-session.test.ts` | Retained | Every case uses real Auth.js token encode/decode and real middleware. Renewal asserts the renewed payload expiry, secure cookie flags, redirect copying and next-day usability. Every allowlisted path is separately enumerated. |
| `pwa/look-around.test.ts` | Improved | Pinned the documented 30-second requirement rather than deriving the only deadline from the production constant. Added irregular increments and post-threshold hidden-page suppression. Existing hidden/busy scenarios have distinct timing semantics. |
| `pwa/middleware.test.ts` | Retained | Each install asset must bypass even an unavailable authentication service. Private page/API cases remain protected through the same real middleware. |
| `pwa/service-worker.test.ts` | Improved | Executes the deployed worker script in a VM and dispatches actual registered listeners. Added the evicted offline-document branch. Successful responses, server errors, requests excluded from interception, and cache cleanup retain separate observable assertions. |
| `sandbox/auth.test.ts` | Improved | The active-workspace test previously supplied a matching profile regardless of query scope. It now pins the full actual SQL predicate and parameters. Added a production recheck for a previously registered provider and a missing signed-in identity; kept production/provider claim guards. |
| `sandbox/enabled.test.ts` | Retained | Production denial, development/test enablement, and fixed local workspace IDs are the sandbox isolation contract. Exact IDs matter because intake and profile seeding share these identifiers. |
| `sandbox/envelope.test.ts` | Improved | Envelopes are passed to the real intake inspector. Expected message keys now use literal local team/channel IDs rather than calling the same key helper as production. Timestamp validity/uniqueness and revision/author preservation remain separate cases. |
| `sandbox/middleware.test.ts` | Retained | Mocks only session acquisition while exercising real middleware decisions. Tests distinguish public development sandbox, protected production sandbox and private API access. |
| `sandbox/reset.test.ts` | Improved | Generated SQL is the correct contract for workspace-scoped destructive statements without executing deletes. Added the omitted admin-status-change statement and asserted the workspace predicate on corrections as well as ordinary statuses. |
| `sandbox/service.test.ts` | Retained | This suite tests service orchestration, not model accuracy or database persistence. It mocks database/inbox boundaries while retaining real envelope creation, shorthand choice and outcome shaping. Every case observes a result, rejection or suppression of consumer work. |
| `utils/fetchers.test.ts` | Improved | Replaced hand-built response objects with real Response objects and removed the unused auth mock and false authentication claim. Globals and environment now restore after each case. Retained read/write failure and local-origin cases, and added rejection before parsing plus network-error identity. |
| `utils/format-date.test.ts` | Retained | The three cases exercise the displayed absence of redundant ranges, same-year labels with padding/month changes, and both years across year boundaries. Literal expected labels catch user-visible formatting regressions. |
| `lib/actions/auth.test.ts` | Improved | Exact provider and redirect arguments are meaningful at this thin Auth.js boundary. Tests now also check return values, exclusive sign-in/sign-out dispatch and redirect-error identity, with mocks reset between cases. |
| `lib/auth/require-user.test.ts` | Improved | Uses the real Next server renderer because ordinary backend React.cache calls do not prove request caching. Added repeated role reads, a same-person demotion on the next render, another signed-in person, and a revoked session. Checks both returned values and one lookup per render. |
| `lib/services/overviewStatusWindow.integration.test.ts` | Added replacement | Every fixture is selected by the real compiled production predicate in a PostgreSQL VALUES CTE. Each asserts selected IDs independently before comparing full-history presence and week resolution. No persistent rows are created. SLACK_TEST_DATABASE=1 is the existing opt-in integration guard. |
| `lib/services/overviewStatusWindow.test.ts` | Improved | Retained Copenhagen/DST and actual compiled SQL/parameter contracts. Added empty, unsorted, duplicated and future day requests. Removed the handwritten statusMayAffectOverview predicate; its 13 business cases moved to actual PostgreSQL execution below. |
| `lib/services/userService.concurrency.test.ts` | Improved | Deferred relation results prove reads start before any deferred result resolves, which detects serialized reads. The list case now uses two people with reversed relation-row order and distinct organisation, role, phone and status values to detect association leaks. The null-today case retains a call-count assertion because avoiding a duplicate resolver call is the behavior under test. |
| `lib/status/active.test.ts` | Improved | These cases call actual active selection with independent dates. Approximate arrival now asserts the selected row identity rather than merely non-null. Added newest-announcement selection in both input orders and empty selection. |
| `lib/status/correction.test.ts` | Improved | Retained output plans and source-preservation semantics. Added both sides of date rejection, specific rejection messages, a missing original revision timestamp and equal-time non-supersession. |
| `lib/status/emoji.test.ts` | Improved | The default test previously derived expectations from the same exported map as production. It now pins all eleven attendance defaults independently. Relevant Unicode graphemes, Slack names, source order and per-status choices remain real output contracts. |
| `lib/status/plan.test.ts` | Retained | All seven cases assert concrete planned rows, time-zone instants, human-readable validation failures or resulting board behavior. Grouped assertions cover distinct day/run, office-arrival, timed-arrival, range and privacy rules; none asserts private helper calls. |
| `lib/status/presence.test.ts` | Retained | Every expanded case calls the real resolver at fixed Copenhagen clocks and checks explicit presence, absence or note values. Boundary pairs, explicit exceptions, approximate clocks and weekend behavior are distinct domain contracts. |
| `lib/status/week.test.ts` | Retained | All 24 expanded cases separate live presence from the daily announcement where appropriate. Real date navigation, ISO week numbers, midnight, clock-boundary and declaration/revision replacement scenarios have independent expected results. |

## Removed and replaced checks

Removed the unit-local `statusMayAffectOverview` implementation and its 12 fixture-driven equivalence cases plus the 500-row history case from `overviewStatusWindow.test.ts`. They could keep passing after the production SQL predicate broke because they ran a copied predicate. All 13 scenarios now execute the real predicate in `overviewStatusWindow.integration.test.ts`; their explicit inclusion/exclusion expectations also prevent two equal but incorrect resolver results from passing unnoticed. The ordinary unit suite retains the full compiled SQL and bound-parameter contract when integration tests are opted out.

The six original fetcher cases retain read/write success, HTTP failure and default-origin coverage in the rewritten suite. Removed the unused auth mock, the incorrect claim that fetchData calls auth, leaked global-fetch replacement and un-restored direct environment writes. Eight current cases add network failure identity and verify HTTP failure before JSON parsing.

The three original email groups are split into eleven concrete cases. Valid, malformed and empty inputs remain covered; plus aliases and deceptive company-domain suffixes now have independent cases.

No original behavior scenario was deleted without replacement. No production bug was confirmed in this scope. The weaknesses corrected were test blind spots, unproven request-boundary claims and fixture isolation. Real browser installation/OAuth/model behavior stays outside these unit tests; the corresponding documented preview/device checks still apply.

## Verification

- Focused scope: 201 passed, 0 failed, 0 skipped across 26 files with the existing integration guard enabled against the disposable PostgreSQL database. The strengthened real-RSC case and class helper were rerun separately after their final edits and passed.
- SQL replacement uses PostgreSQL itself with parameterized VALUES rows and performs no persistent writes. No SQLite dependency or custom SQL predicate evaluator was introduced.
- Four isolated Vite source-transform checks left shared production files untouched: wrong FROM_HOME emoji caused 3 failures; inverted sandbox deactivation flag caused 1 failure; moving the endsAt lower bound to the exclusive upper midnight caused 3 PostgreSQL failures; changing GET credentials to omit caused 1 failure.
- Ordinary tests after the transform checks passed. Mutation configurations and JSON logs live in `/tmp`, not the repository. Parent owns the final combined backend, typecheck, lint and diff checks.

## Every-case review

### `className.test.ts`

| Case and purpose | Observable regression caught |
| --- | --- |
| merges class names correctly | Plain strings must both reach the rendered class list. |
| handles conditionals like clsx | Nested arrays and enabled flags survive; false/null/undefined entries disappear. |
| applies tailwind-merge rules | The later horizontal padding wins without deleting text size or hover padding. |

### `userHelper.test.ts`

| Case and purpose | Observable regression caught |
| --- | --- |
| accepts the company email test.user@charlietango.dk | A valid company-domain local part, including the named alias form, passes validation. |
| accepts the company email alias+project@charlietango.dk | A valid company-domain local part, including the named alias form, passes validation. |
| rejects malformed or other-domain address test.user@external.com | The exact malformed or deceptive-domain example fails; suffix and subdomain matches cannot pass. |
| rejects malformed or other-domain address testuser | The exact malformed or deceptive-domain example fails; suffix and subdomain matches cannot pass. |
| rejects malformed or other-domain address testuser@charlietango | The exact malformed or deceptive-domain example fails; suffix and subdomain matches cannot pass. |
| rejects malformed or other-domain address test@charlietango.dk.attacker.example | The exact malformed or deceptive-domain example fails; suffix and subdomain matches cannot pass. |
| rejects malformed or other-domain address test@othercharlietango.dk | The exact malformed or deceptive-domain example fails; suffix and subdomain matches cannot pass. |
| rejects malformed or other-domain address test@sub.charlietango.dk | The exact malformed or deceptive-domain example fails; suffix and subdomain matches cannot pass. |
| rejects malformed or other-domain address @charlietango.dk | The exact malformed or deceptive-domain example fails; suffix and subdomain matches cannot pass. |
| rejects malformed or other-domain address test user@charlietango.dk | The exact malformed or deceptive-domain example fails; suffix and subdomain matches cannot pass. |
| rejects empty input | An absent address cannot be treated as a valid company address. |

### `auth/roles.test.ts`

| Case and purpose | Observable regression caught |
| --- | --- |
| reads the stored ADMIN role, rather than session claims | The named stored role is returned, and all user/workspace/active/mapped membership predicates stay bound. |
| reads the stored MANAGER role, rather than session claims | The named stored role is returned, and all user/workspace/active/mapped membership predicates stay bound. |
| reads the stored EMPLOYEE role, rather than session claims | The named stored role is returned, and all user/workspace/active/mapped membership predicates stay bound. |
| fails closed for unknown roles and missing/inactive workspace accounts | Missing database membership and unrecognized role values deny access. |
| fails closed before querying when no workspace is configured | Missing workspace configuration denies access before a database lookup. |
| uses the latest stored role on independent uncached calls | Sequential uncached reads return updated stored roles rather than stale prior results. |
| does not allow MANAGER to perform admin operations | This non-admin role reaches notFound rather than receiving an authorized actor ID. |
| does not allow EMPLOYEE to perform admin operations | This non-admin role reaches notFound rather than receiving an authorized actor ID. |
| allows an active admin to perform admin operations | An authorized admin receives the authenticated actor ID. |
| rejects an unauthenticated request before querying | Missing session denies the operation before a role lookup. |

### `lib/auth-session.test.ts`

| Case and purpose | Observable regression caught |
| --- | --- |
| renews the secure cookie after eight hours on /today | A signed Slack token gains a secure 90-day cookie after nine hours; the named response path preserves it and it works the next day. |
| renews the secure cookie after eight hours on / | A signed Slack token gains a secure 90-day cookie after nine hours; the named response path preserves it and it works the next day. |
| rejects missing sessions for pages and APIs | The named invalid token form yields a login redirect for pages and a JSON 401 for APIs. |
| rejects expired sessions for pages and APIs | The named invalid token form yields a login redirect for pages and a JSON 401 for APIs. |
| rejects tampered sessions for pages and APIs | The named invalid token form yields a login redirect for pages and a JSON 401 for APIs. |
| bypasses session handling for /api/auth | This exact service/auth callback remains accessible without session renewal cookies. |
| bypasses session handling for /api/auth/callback/slack | This exact service/auth callback remains accessible without session renewal cookies. |
| bypasses session handling for /api/auth/signout | This exact service/auth callback remains accessible without session renewal cookies. |
| bypasses session handling for /api/check-users | This exact service/auth callback remains accessible without session renewal cookies. |
| bypasses session handling for /api/slack/events | This exact service/auth callback remains accessible without session renewal cookies. |
| bypasses session handling for /api/queues/slack-status | This exact service/auth callback remains accessible without session renewal cookies. |
| bypasses session handling for /api/slack/process | This exact service/auth callback remains accessible without session renewal cookies. |
| bypasses session handling for /api/slack/install | This exact service/auth callback remains accessible without session renewal cookies. |
| bypasses session handling for /api/slack/install/callback | This exact service/auth callback remains accessible without session renewal cookies. |
| keeps the login page public and redirects signed-out root visits | Signed-out login is public while root leads to login. |
| keeps development redirects on the configured tunnel origin | A development request behind localhost redirects to AUTH_URL rather than losing the configured tunnel host. |

### `pwa/look-around.test.ts`

| Case and purpose | Observable regression caught |
| --- | --- |
| waits until WØRK has been in view for the full look-around time | The invitation remains hidden for the first 29 seconds and becomes ready at the documented 30 seconds. |
| handles an irregular polling step at the threshold | Nonuniform polling honors the exact threshold, and hiding the page suppresses readiness even after the deadline. |
| does not count time while the page is hidden | Sixty hidden seconds do not advance a nearly complete visible-time wait. |
| waits for another dialog to close before appearing | Visible time accumulates behind another dialog but readiness waits until that dialog closes. |

### `pwa/middleware.test.ts`

| Case and purpose | Observable regression caught |
| --- | --- |
| serves /manifest.webmanifest without authentication or redirects | This exact installation asset bypasses a throwing auth service without a redirect. |
| serves /sw.js without authentication or redirects | This exact installation asset bypasses a throwing auth service without a redirect. |
| serves /offline.html without authentication or redirects | This exact installation asset bypasses a throwing auth service without a redirect. |
| keeps private pages and APIs protected | Ordinary private pages redirect to login and private APIs return 401. |

### `pwa/service-worker.test.ts`

| Case and purpose | Observable regression caught |
| --- | --- |
| precaches only the anonymous offline document | Only the static offline document is cached, and its request omits credentials. |
| returns a network response without caching colleague data | The network response identity is preserved and no cache is opened or written for private colleague data. |
| shows the offline document only when a document request fails | A rejected navigation fetch resolves to the precached offline document. |
| returns a network error when the offline document was evicted | A rejected navigation with no cached offline screen resolves to Response.error rather than undefined. |
| preserves server errors instead of masking them as offline | A successful HTTP exchange with status 503 remains the server response, not an offline fallback. |
| leaves APIs, mutations, bundles, RSC and external requests alone: {"url":"https://work.example/api/auth/signin","method":"GET","mode":"navigate"} | This exact method/mode/origin/API combination is not intercepted and does not start a worker fetch. |
| leaves APIs, mutations, bundles, RSC and external requests alone: {"url":"https://work.example/api/users","method":"GET","mode":"cors"} | This exact method/mode/origin/API combination is not intercepted and does not start a worker fetch. |
| leaves APIs, mutations, bundles, RSC and external requests alone: {"url":"https://work.example/today","method":"POST","mode":"navigate"} | This exact method/mode/origin/API combination is not intercepted and does not start a worker fetch. |
| leaves APIs, mutations, bundles, RSC and external requests alone: {"url":"https://work.example/today","method":"GET","mode":"cors"} | This exact method/mode/origin/API combination is not intercepted and does not start a worker fetch. |
| leaves APIs, mutations, bundles, RSC and external requests alone: {"url":"https://work.example/_next/static/chunk.js","method":"GET","mode":"no-cors"} | This exact method/mode/origin/API combination is not intercepted and does not start a worker fetch. |
| leaves APIs, mutations, bundles, RSC and external requests alone: {"url":"https://slack.com/oauth/authorize","method":"GET","mode":"navigate"} | This exact method/mode/origin/API combination is not intercepted and does not start a worker fetch. |
| removes only old WØRK offline caches on activation | Activation deletes the old Wørk cache only, preserves current/unrelated caches and claims clients. |

### `sandbox/auth.test.ts`

| Case and purpose | Observable regression caught |
| --- | --- |
| is not registered in production builds | A production build receives no sandbox provider. |
| is registered outside production under its own id | Development registers exactly the dedicated credentials provider ID. |
| authorizes only active profiles of the sandbox workspace | Successful lookup uses the chosen profile, local workspace and active flag; absent profiles and missing credentials deny. |
| rechecks the production guard even for a provider registered in development | A stale development provider still refuses credentials after switching to production, without querying profiles. |
| masquerades as the Slack provider and records the truth for display | Sandbox sign-in sets Slack authorization identity plus an explicit sandbox display marker. |
| leaves the token untouched in production builds | Production cannot mutate a supplied token into a sandbox-authorized Slack session. |
| ignores sign-ins through other providers | Ordinary Slack sign-in identity is not replaced by sandbox logic. |
| does not mint a sandbox claim without a signed-in profile | A provider account without a signed-in profile ID cannot mint new identity claims. |

### `sandbox/enabled.test.ts`

| Case and purpose | Observable regression caught |
| --- | --- |
| is inert in production builds | Both boolean guard and throwing guard disable sandbox in production. |
| is enabled when NODE_ENV is development | The named nonproduction environment enables both guard forms. |
| is enabled when NODE_ENV is test | The named nonproduction environment enables both guard forms. |
| never uses the real workspace identifiers | Reserved local IDs stay separate from the real workspace/channel. |

### `sandbox/envelope.test.ts`

| Case and purpose | Observable regression caught |
| --- | --- |
| produces Slack wire format for the announcement instant | Generated timestamp has Slack seconds.microseconds shape and retains the requested announcement second. |
| stays distinct for messages announced in the same millisecond | Fifty same-millisecond declarations have distinct inbox timestamp identities. |
| rejects instants Slack could not have produced | Invalid and pre-Slack epoch instants cannot enter the generated event identity. |
| build a message the intake accepts as pending | The real inspector accepts author/text/key/team/channel/revision as a pending local message. |
| build an edit whose revision is the edit instant | The real inspector preserves the original key and uses the newer edit instant as its revision. |
| build a deletion that keeps the author for identity lookup | Deletion retains author identity and revision while removing message text. |
| are rejected by an intake configured for the real workspace | Real-workspace intake rejects a locally constructed envelope. |

### `sandbox/middleware.test.ts`

| Case and purpose | Observable regression caught |
| --- | --- |
| is reachable without a session outside production | Development sandbox loads without acquiring a session. |
| is treated like any other page in production builds | Signed-out production sandbox redirects to login. |
| does not widen the service route allowlist | A similarly named API path remains protected with 401. |

### `sandbox/reset.test.ts`

| Case and purpose | Observable regression caught |
| --- | --- |
| deletes admin changes only for profiles of the sandbox workspace | The named delete statement targets only local workspace rows, through a local-profile subquery when rows are person-owned. |
| deletes status rows only for profiles of the sandbox workspace | The named delete statement targets only local workspace rows, through a local-profile subquery when rows are person-owned. |
| deletes inbox rows only for the sandbox workspace | The named delete statement targets only local workspace rows, through a local-profile subquery when rows are person-owned. |
| deletes status corrections only for profiles of the sandbox workspace | The named delete statement targets only local workspace rows, through a local-profile subquery when rows are person-owned. |
| deletes learned shorthands only for the sandbox workspace | The named delete statement targets only local workspace rows, through a local-profile subquery when rows are person-owned. |

### `sandbox/service.test.ts`

| Case and purpose | Observable regression caught |
| --- | --- |
| reads a Europe/Copenhagen wall clock | Winter/summer wall-clock announcements become the correct UTC instants. |
| rejects malformed input and DST gaps | Malformed wall-clock text and a nonexistent spring DST time reject before intake. |
| requires the model for shorthand that has earlier same-person context | Earlier attendance context prevents shorthand bypassing the model-key requirement. |
| refuses to send when the intake is configured for another workspace | Misconfigured real workspace rejects with SandboxInputError before enqueue. |
| fails up front without an AI key unless shorthand handles the text | Model-required text fails without a key, while standalone deterministic shorthand still works. |
| sends a learned shorthand without an AI key | An eligible learned phrase is processed without requiring a model key. |
| feeds a genuine envelope through the intake and reports the committed interpretation | Author/text/time feed envelope creation and queue dispatch; committed intervals expose clock and approximation flags. |
| renders a scheduled retry as a normal outcome with the likely reason | A pending inbox exception becomes retry metadata with delay, likely unmapped-author reason and no interpretation. |
| surfaces duplicate_or_stale instead of processing | A duplicate/stale intake outcome skips consumer work instead of reprocessing. |
| reports an intake rejection without touching the consumer | An ignored intake outcome preserves its reason and skips consumer work. |
| send message_changed with a newer revision | Edits retain the original timestamp and send changed text under a newer revision. |
| send message_deleted and run the consumer for the broadcast | Deletions dispatch message_deleted, run the queue consumer and report a deleted terminal outcome without interpretation. |

### `utils/fetchers.test.ts`

| Case and purpose | Observable regression caught |
| --- | --- |
| reads fresh API data with same-origin credentials | GET retains configured origin/query, JSON headers, same-origin credentials, no-store and parsed output. |
| posts a serialized body and returns the API result | POST retains configured route, exact serialized body, no-store and parsed output. |
| rejects unsuccessful read responses before parsing the body | The named operation throws its endpoint error on 403 before attempting to parse invalid JSON. |
| rejects unsuccessful write responses before parsing the body | The named operation throws its endpoint error on 403 before attempting to parse invalid JSON. |
| uses the local API origin for read when no origin is configured | The named operation uses localhost:3000 only when the configured API origin is absent. |
| uses the local API origin for write when no origin is configured | The named operation uses localhost:3000 only when the configured API origin is absent. |
| preserves a network failure for a read request | The named operation returns the original network rejection rather than masking it with response handling. |
| preserves a network failure for a write request | The named operation returns the original network rejection rather than masking it with response handling. |

### `utils/format-date.test.ts`

| Case and purpose | Observable regression caught |
| --- | --- |
| returns null when fromDate or toDate is missing or identical | Incomplete or same-day ranges render no redundant label. |
| removes the year when start and end share the same year | Same-year labels omit years and preserve padded dates, including a month change. |
| preserves both years when start and end span different years | Cross-year labels retain each year so the span is unambiguous. |

### `lib/actions/auth.test.ts`

| Case and purpose | Observable regression caught |
| --- | --- |
| starts Slack sign-in and returns its result | Slack sign-in receives the root redirect and its resolved value reaches the caller. |
| signs out and returns its result | Sign-out receives the root redirect and its resolved value reaches the caller. |
| propagates the Auth.js redirect from login | The named action preserves the Auth.js redirect exception identity. |
| propagates the Auth.js redirect from logout | The named action preserves the Auth.js redirect exception identity. |

### `lib/auth/require-user.test.ts`

| Case and purpose | Observable regression caught |
| --- | --- |
| deduplicates session and role checks within a render and rechecks the next render | Four real RSC renders deduplicate checks, apply a same-user demotion immediately, avoid sharing another user session, and deny revocation. |

### `lib/services/overviewStatusWindow.integration.test.ts`

| Case and purpose | Observable regression caught |
| --- | --- |
| selects candidates and preserves full-history resolution for expired date range | An expired bounded date row is absent from SQL results and cannot affect presence/week output. |
| selects candidates and preserves full-history resolution for future date range | A wholly later bounded date row is excluded without changing the viewed dates. |
| selects candidates and preserves full-history resolution for spanning dates | A row crossing both ends of the window survives selection. |
| selects candidates and preserves full-history resolution for open start | A null start remains eligible when its end overlaps. |
| selects candidates and preserves full-history resolution for open end | A null end remains eligible when its start overlaps. |
| selects candidates and preserves full-history resolution for legacy no dates | An unbounded legacy row survives the conservative database filter. |
| selects candidates and preserves full-history resolution for conflicting start clock | A clock inside the window escapes otherwise expired date bounds. |
| selects candidates and preserves full-history resolution for expired clock still suppresses default | An end clock inside the window survives even after the live interval ends. |
| selects candidates and preserves full-history resolution for approximate clock | An approximate end clock survives selection and retains resolver behavior. |
| selects candidates and preserves full-history resolution for legacy arrival | A timeless-date legacy office arrival survives and resolves with its arrival time. |
| selects candidates and preserves full-history resolution for midnight clock | The exact first midnight endpoint is included. |
| selects candidates and preserves full-history resolution for exclusive next midnight | The exact midnight after the last queried day is excluded. |
| drops large expired histories while retaining clock-only default suppression | PostgreSQL discards 500 expired rows yet keeps the sole expired clock needed to suppress an office default. |

### `lib/services/overviewStatusWindow.test.ts`

| Case and purpose | Observable regression caught |
| --- | --- |
| includes actual today and uses Copenhagen midnights across the DST change | Actual Copenhagen today is included and the interval spans different UTC offsets at its two midnights. |
| covers today alone when no dates are requested | An empty displayed-date set still queries the full current Copenhagen day. |
| sorts requested days and includes today before future days | Unsorted/duplicate future days produce today through the maximum requested date. |
| applies the date overlap and both half-open clock escapes to the database query | Actual query compilation retains inclusive/open dates, both clock endpoint escape clauses, half-open bounds and ordered UTC parameters. |

### `lib/services/userService.concurrency.test.ts`

| Case and purpose | Observable regression caught |
| --- | --- |
| starts all getUserById reads together and preserves enriched values | All five reads start before held relations resolve, and organisation/roles/phone/status survive enrichment. |
| preserves null defaults when the user has no optional relations or status | Missing optional relations remain null or empty and no organisation query is started. |
| starts getAllUsers relation reads together and preserves list enrichment | Held bulk reads start together; reversed relation-row order maps distinct values to the correct two people. |
| returns null for a missing user without starting relation reads | A missing account returns null after one query with no relation work. |
| reuses the today cell even when its presence is null after an expired clock interval | A resolved-null today cell is reused instead of invoking the resolver twice or inventing presence. |

### `lib/status/active.test.ts`

| Case and purpose | Observable regression caught |
| --- | --- |
| uses Copenhagen dates for inclusive date ranges | Copenhagen midnight, rather than UTC midnight, bounds a one-day declaration. |
| treats timed statuses as half open intervals and skips future rows | Exact start applies and exact end does not; future rows cannot displace the current one. |
| resumes an older applicable range after a newer interval ends | An older multi-day declaration becomes visible again after a newer short interval ends. |
| does not expire approximate arrival at its nominal clock time | The approximate row itself remains selected after nominal arrival, then expires at its date boundary. |
| orders UTC announcement instants across mixed database wall-clock createdAt values | The actual announcement instant wins over misleading database wall-clock ordering. |
| selects the newest applicable announcement independently of input order | Latest applicable declaration wins in either input order and empty history returns null. |

### `lib/status/correction.test.ts`

| Case and purpose | Observable regression caught |
| --- | --- |
| replaces one day or the whole imported interval | Day scope narrows dates; declaration scope keeps the full original span, notes survive suitable replacements and clock is cleared. |
| drops notes that would mislead on the corrected status | Sickness and importer-generated unspecified-arrival notes do not leak misleading text into a correction. |
| lets a note saved without a status become a status | A description-only imported declaration can gain an explicit attendance status. |
| rejects manual statuses, days outside the import and unchanged statuses | Manual source, both outside-span directions, and an unchanged choice return their specific safe errors. |
| records the revision only when it wrote the imported Declaration | Only an exact announcement/revision instant match is accepted, including missing-original and missing-message guards. |
| treats a correction as superseded only by a newer overlapping Declaration | Self, older/equal-time and non-overlapping rows do not supersede; a newer overlapping declaration does. |

### `lib/status/emoji.test.ts`

| Case and purpose | Observable regression caught |
| --- | --- |
| has a default for every attendance status and none for description-only declarations | All eleven independent default glyphs are pinned and a description-only declaration gets none. |
| keeps the first relevant emoji, rather than unrelated greetings or reactions | Relevant emoji wins over unrelated greeting/reaction glyphs; unsuitable choices fall back. |
| preserves full graphemes and variation selectors and skips unsupported composites | Variation selectors and skin tones remain intact while unsupported composed sequences fall back. |
| resolves known Slack emoji in message order and ignores custom emoji | Known Slack shortcodes compete in source order with Unicode; custom and irrelevant emoji cannot replace defaults. |
| selects separately for each status in a multi-interval declaration | One multi-day message supplies distinct relevant choices for each resolved attendance status. |

### `lib/status/plan.test.ts`

| Case and purpose | Observable regression caught |
| --- | --- |
| groups picked days into runs and bridges weekends | Sorted/deduplicated days become runs, weekends bridge them and the chosen attendance/details survive. |
| stores timed statuses per day at Copenhagen wall-clock time | The same Copenhagen wall clock yields the correct separate UTC instants before and after DST. |
| keeps office time optional and stores a specified arrival on each day | Untimed office days coalesce, while specified arrival times produce per-date instants. |
| expands a timed office period and accepts a past arrival today | Office ranges expand per date, permit a past arrival and past range start, and reject more than 62 timed days. |
| rejects past days, passed times and inverted periods with readable messages | Past dates/clocks, missing required times, reversed ranges and impossible dates retain readable validation failures. |
| keeps a period as one declaration and drops details for sickness | A vacation range stays one declaration, and sickness drops private details. |
| shows planned days on the week board | Real planner output resolves into the correct week statuses and arrival note; expired plans disappear from upcoming declarations. |

### `lib/status/presence.test.ts`

| Case and purpose | Observable regression caught |
| --- | --- |
| does not spawn before 9 and defaults exactly at 9 in summer | Summer default starts exactly at 09:00 Copenhagen, with absence immediately before. |
| uses Copenhagen winter time and resets the following morning | Winter uses UTC+1 and yesterday attendance does not carry into the next morning. |
| spawns an explicit 7am arrival at 7, never earlier | Explicit early office attendance starts at its own exact arrival boundary. |
| shows a scheduled office arrival as late until the clock time, then in office | Late and early office clocks transition at arrival, with the correct retained arrival note. |
| preserves an explicit FROM_HOME declaration after 9 | The named explicit exception remains visible after the workday default would normally begin. |
| preserves an explicit REMOTE declaration after 9 | The named explicit exception remains visible after the workday default would normally begin. |
| preserves an explicit SICK declaration after 9 | The named explicit exception remains visible after the workday default would normally begin. |
| preserves an explicit VACATION declaration after 9 | The named explicit exception remains visible after the workday default would normally begin. |
| preserves an explicit AT_CLIENT declaration after 9 | The named explicit exception remains visible after the workday default would normally begin. |
| keeps description-only announcements without inventing office attendance | An explicit note remains status-null rather than turning into assumed office attendance. |
| resolves legacy manual arrival times and retains approximate arrivals | Legacy late clocks transition exactly; approximate arrivals remain unconfirmed past the nominal clock. |
| shows office presence until a manual departure, with its departure note | Office presence and departure note appear before departure; leaving-early appears at its clock. |
| does not override a newer explicit status with a timed transition | An automatic clock transition cannot overrule a newer home declaration. |
| does not let next week’s vacation suppress today, but respects today’s future arrival | Later-date vacation does not suppress today, while today future arrival does suppress a premature office default. |
| does not default on weekends but honors explicit weekend arrival | Weekends lack an implicit office default but respect explicit attendance. |
| does not carry an arrival emoji into resolved office attendance | An arrival-specific emoji is removed when resolved presence becomes office attendance. |

### `lib/status/week.test.ts`

| Case and purpose | Observable regression caught |
| --- | --- |
| snaps weekdays to Monday and weekends to the coming week | Weekday and both weekend navigation offsets produce the documented Monday and five weekdays. |
| falls back to the current Copenhagen week for invalid input | Invalid dates and array parameters use current Copenhagen week; a valid requested date selects its Monday. |
| numbers weeks across year boundaries | Regular, ISO week 53 and next-year week 1 labels remain correct. |
| applies declarations to their own days and the workday default elsewhere | Vacation occupies only its date span, with pre-09:00 today absent and other days defaulting at workday start. |
| shows a planned late arrival on its day and resolves today live | A future day previews its late arrival while today changes live across that clock. |
| uses the Copenhagen calendar date for today, including the UTC date boundary | UTC evening crossover changes which Copenhagen day resolves live. |
| resolves today before 09:00 as absent and from 09:00 using the actual current time | Today uses the actual clock, so the default appears exactly at workday start. |
| keeps weekend today on the weekend instead of resolving the coming Monday | An explicitly requested Sunday remains Sunday with null presence/announcement. |
| keeps the imported announcement at 08:29:59 while presence is IN_LATE | At this distinct clock the daily exception stays visible while live presence matches the named status. |
| keeps the imported announcement at 08:30:00 while presence is IN_OFFICE | At this distinct clock the daily exception stays visible while live presence matches the named status. |
| keeps the imported announcement at 16:00:00 while presence is IN_OFFICE | At this distinct clock the daily exception stays visible while live presence matches the named status. |
| keeps the imported announcement at 22:59:59 while presence is IN_OFFICE | At this distinct clock the daily exception stays visible while live presence matches the named status. |
| retains a timed AWAY declaration after its office return | The named non-office declaration remains the daily announcement after its companion office-return interval starts. |
| retains a timed FROM_HOME declaration after its office return | The named non-office declaration remains the daily announcement after its companion office-return interval starts. |
| retains a timed REMOTE declaration after its office return | The named non-office declaration remains the daily announcement after its companion office-return interval starts. |
| expires the daily announcement at Copenhagen midnight | Next Copenhagen midnight clears both the old announcement and weekend presence. |
| retains a manual IN_LATE announcement before and after its clock | The named manual declaration stays visible before, at and after its clock; office-arrival labels normalize to late. |
| retains a manual LEAVING_EARLY announcement before and after its clock | The named manual declaration stays visible before, at and after its clock; office-arrival labels normalize to late. |
| retains a manual IN_OFFICE announcement before and after its clock | The named manual declaration stays visible before, at and after its clock; office-arrival labels normalize to late. |
| lets a newer declaration or revision replace the old exception (null) | The named manual/new-source/same-source newer declaration replaces the older exception. |
| lets a newer declaration or revision replace the old exception (channel:new-message) | The named manual/new-source/same-source newer declaration replaces the older exception. |
| lets a newer declaration or revision replace the old exception (channel:message) | The named manual/new-source/same-source newer declaration replaces the older exception. |
| lets a newer correction replace the imported announcement | A newer manual correction replaces the imported announcement for the day. |
| does not reuse an older exception from the same Slack source revision | A companion office interval cannot revive an exception from an older revision of its Slack source. |
