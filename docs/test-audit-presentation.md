# Presentation and access unit test audit

Scope covers all 33 backend files listed below and both Button story files. Every expanded test case was read with its production function/component and relevant callers. Integration files are excluded. CONTEXT.md, docs/office-presence.md, docs/employee-stats.md, docs/message-quality.md, docs/access-control.md and docs/theming.md supplied domain requirements. The unslop skill was applied to this report.

Baseline had 380 owned backend cases. Current focused run passes all 404 cases in 33 files, with zero failures or skips. Existing behaviors were retained unless an assertion was misleading or incomplete. No production files changed. No test files were removed.

## Material changes and replacements

- admin/roles now uses the real activeWorkspaceMember predicate, replacing a duplicated test implementation. Empty Slack IDs and transaction/revalidation order have explicit protection.
- A profile search test formerly only asserted that an unsearched result link was absent. Its old case, "employee profile page keeps the period and comparison when searching for someone else", is replaced by two real page-to-search contracts covering norm/90 and alone/all. They render a matching query and inspect the produced destination.
- The theme case "themes.css has a token set to compare against" is replaced by "themes.css defines the background, foreground, and action tokens consumed by the interface". A count greater than 20 did not establish any required token; the replacement names required roles.
- ButtonClickTests no longer appends a success sentence to the shared Storybook root. An isolated handler spy now proves one mouse activation, one Enter activation and one Space activation. The other four original story exports remain, with stronger accessible-role, label, type and destination assertions. Four new stories cover loading buttons, children-only links, loading links and missing destinations.
- Fixed clocks make colleague planning deterministic. Today page tests mock the admin/session/service boundaries and now prove no reads occur before login, as well as forwarding current admin permission and personal plans.
- Daily costs assert the entire row for each date. Extreme AI shares assert the correct category, not merely the presence of both 0% and 100%.
- Added exact per-status attendance mapping, replacement run splitting, announcement-time boundary and all date fields on cache hits and misses.
- Corrected a history fixture comment and made environment cleanup failure-safe. The side-panel test now checks actual membership in the toolbar actions instead of implying strict adjacency through a greedy regular expression.

No behavior case was discarded without replacement. All other original cases are retained below because they check runtime behavior, numerical contracts, CSS schema/accessibility, or boundary side effects.

## Verification and fault checks

The focused command passed using an explicit list from the six owned directories plus admin-status-change/replaced.test.ts, selecting only filenames ending in .test.ts and excluding .integration.test.ts. Result JSON is /tmp/work-test-audit/presentation-results.json. ESLint, Prettier, tsc --noEmit and git diff --check passed. The parent runs final whole-repository checks. The production Storybook build passed. The CI Storybook runner passed all 29 stories in seven files, including all nine audited Button stories, with zero axe violations.

Five isolated Vite transforms changed backend module code only in memory. No production source was temporarily edited. Every fault produced assertion failures, recorded in /tmp/work-test-audit/presentation-mutations.jsonl:

| Fault | Concrete failing protection |
| --- | --- |
| Swap FROM_HOME and CHILD_SICK attendance groups | Individual status counts, known company totals and explicit per-day codes |
| Remove rejection of an empty Slack mapping | Admin actor recheck, target update scope and role-list query checks |
| Drop comparison from profile search suffix | Both norm/90 and alone/all destination tests |
| Render every daily table cost as zero | Exact dated table rows and all-unknown costs |
| Skip today-page authentication | No reads before login |
| Remove the built Button callback in an isolated HTTP response | ButtonClickTests failed because handleClick was called zero times after one click; all other 28 browser stories passed |

The sixth fault used the already-built webpack Storybook bundle. A temporary HTTP server changed exactly one runtime expression, onClick:handleClick, to onClick:void 0 in its response. The runner executed all 29 stories, with only ButtonClickTests failing its direct callback assertion. The server was stopped after the check. The source files and built artifacts were untouched. Report: /tmp/work-test-audit/presentation-built-button-callback.json. A prior Vite-only mutation attempt failed during framework setup and is not counted as a killed mutant.

No production behavior bug was found in this scope. The defects repaired here were in test strength and isolation. The optional Vite story project remains incompatible with the installed Next.js adapter and is documented by the parent; the existing webpack Storybook runner executed every authored story. Existing integration coverage is neither executed nor replaced here.

## File and case ledger

Each case name states its purpose. The final column explains the retention/change decision and the behavior observed. A passing case in the focused run is marked Pass; parameterized cases are listed separately so no generated case is hidden.

### tests/backend/admin-status-change/replaced.test.ts

File decision: improved. Production read: lib/status/admin-change.ts and statusService.createColleagueStatuses. Exact replacement records protect audit history, source revision attribution and run boundaries. These are data contracts consumed by the admin-change recorder.

| Case and purpose | Decision | Verification and rationale |
| --- | --- | --- |
| replacedAnnouncements records the imported status and revision an admin overwrote | Retained | Pass. Compares returned audit records or date runs, protecting which Declaration was replaced and its source/revision metadata. |
| replacedAnnouncements groups consecutive days and leaves out days without a Declaration | Retained | Pass. Compares returned audit records or date runs, protecting which Declaration was replaced and its source/revision metadata. |
| replacedAnnouncements keeps the import link without a revision once the message was edited | Retained | Pass. Compares returned audit records or date runs, protecting which Declaration was replaced and its source/revision metadata. |
| replacedAnnouncements marks a status the person set themselves as not imported | Retained | Pass. Compares returned audit records or date runs, protecting which Declaration was replaced and its source/revision metadata. |
| replacedAnnouncements records the newest visible announcement and splits an older run around it | Added/replacement | Pass. Compares returned audit records or date runs, protecting which Declaration was replaced and its source/revision metadata. |
| replacedAnnouncements records no replaced days for an incomplete planned range { fromDate: null, toDate: '2026-11-06' } | Added/replacement | Pass. Compares returned audit records or date runs, protecting which Declaration was replaced and its source/revision metadata. |
| replacedAnnouncements records no replaced days for an incomplete planned range { fromDate: '2026-11-05', toDate: null } | Added/replacement | Pass. Compares returned audit records or date runs, protecting which Declaration was replaced and its source/revision metadata. |

### tests/backend/admin/page.test.ts

File decision: retained. Production read: app/(authenticated)/admin/roles/page.tsx and RoleEditor. Rendered role controls and rejecting auth boundaries protect the role-management page. Exact human-readable roles and the absence of a self-edit control are user requirements.

| Case and purpose | Decision | Verification and rationale |
| --- | --- | --- |
| role management page requires a session before checking access or reading people | Retained | Pass. Asserts the denial result and downstream reads/writes remaining untouched at the authorization boundary. |
| role management page blocks managers and employees from reading roles | Retained | Pass. Checks the rejected boundary result and, where a service is involved, the absence of an unauthorized side effect. |
| role management page explains the roles and allows changing other people, with the caller read-only | Retained | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |

### tests/backend/admin/roles.test.ts

File decision: improved. Production read: app/actions/roleActions.ts, lib/admin/roles.ts, lib/auth/roles.ts. The real workspace predicate and compiled SQL protect query scope. Mock database boundaries exercise transaction ordering, denial, update results and revalidation without claiming PostgreSQL execution coverage.

| Case and purpose | Decision | Verification and rationale |
| --- | --- | --- |
| changing application roles rejects a nonadmin before touching role data | Retained | Pass. Asserts the denial result and downstream reads/writes remaining untouched at the authorization boundary. |
| changing application roles rejects invalid roles and missing people without starting a transaction | Retained | Pass. Checks the rejected boundary result and, where a service is involved, the absence of an unauthorized side effect. |
| changing application roles does not let an admin change their own role | Retained | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |
| changing application roles serializes changes and checks the caller role again before updating | Improved | Pass. Compiles the real SQL predicate and observes action ordering; no copied authorization implementation substitutes for production. |
| changing application roles rejects a caller whose admin role was revoked while they waited | Retained | Pass. Checks the rejected boundary result and, where a service is involved, the absence of an unauthorized side effect. |
| changing application roles limits role changes to active mapped members of the configured workspace | Improved | Pass. Compiles the real SQL predicate and observes action ordering; no copied authorization implementation substitutes for production. |
| changing application roles fails closed when the workspace is missing | Retained | Pass. Missing workspace configuration must reject before a transaction begins. |
| listing application roles checks admin authorization at the read boundary | Retained | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |
| listing application roles returns readable sorted names for active mapped workspace members | Improved | Pass. Compiles the real SQL predicate and observes action ordering; no copied authorization implementation substitutes for production. |

### tests/backend/ai-cost/daily-views.test.ts

File decision: improved. Production read: app/(authenticated)/ai-cost/DailyCostPanel.tsx and lib/ai-cost/stats.ts. Rendered costs, accessible descriptions and actual SVG geometry distinguish no calls, reported zero, unknown and partial costs. The cumulative helper checks real running totals.

| Case and purpose | Decision | Verification and rationale |
| --- | --- | --- |
| daily cost views defaults to bars and exposes the four view controls as pressed buttons | Retained | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |
| daily cost views distinguishes unknown, partial, zero cost and no calls in the daily table | Improved | Pass. Protects the distinction between reported zero, unknown cost and priced calls using real calculation or rendered output. |
| daily cost views retains unknown costs as gaps in the daily line | Retained | Pass. Protects the distinction between reported zero, unknown cost and priced calls using real calculation or rendered output. |
| daily cost views adds only reported costs and carries incomplete status through later days | Retained | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |
| daily cost views keeps all-unknown costs unknown without invalid chart coordinates | Retained | Pass. Covers an explicit absence/zero-denominator boundary so the result does not invent data or invalid numbers. |
| daily cost views shows the empty state in bars view | Retained | Pass. Covers an explicit absence/zero-denominator boundary so the result does not invent data or invalid numbers. |
| daily cost views shows the empty state in line view | Retained | Pass. Covers an explicit absence/zero-denominator boundary so the result does not invent data or invalid numbers. |
| daily cost views shows the empty state in cumulative view | Retained | Pass. Covers an explicit absence/zero-denominator boundary so the result does not invent data or invalid numbers. |
| daily cost views shows the empty state in table view | Retained | Pass. Covers an explicit absence/zero-denominator boundary so the result does not invent data or invalid numbers. |

### tests/backend/ai-cost/message-trend.test.ts

File decision: retained. Production read: app/(authenticated)/ai-cost/MessageTrend.tsx and MessagesHandledPanel.tsx. Runtime charts must preserve daily share/volume scales, inactive-day gaps and accessible descriptions. Geometry assertions detect wrong mathematical plots rather than source spellings.

| Case and purpose | Decision | Verification and rationale |
| --- | --- | --- |
| daily message handling trend defaults to the trend while retaining period totals | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| daily message handling trend uses a fixed percentage scale and leaves a gap on inactive days | Retained | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |
| daily message handling trend shows daily counts and AI percentages in accessible descriptions | Retained | Pass. Uses known attendance/count inputs to verify numeric meaning, exclusions and thresholds instead of matching implementation text. |
| daily message handling trend stacks daily counts against the volume scale and aligns them with share points | Retained | Pass. Uses known attendance/count inputs to verify numeric meaning, exclusions and thresholds instead of matching implementation text. |
| daily message handling trend renders an isolated day as a visible point without connecting over empty days | Retained | Pass. Covers an explicit absence/zero-denominator boundary so the result does not invent data or invalid numbers. |
| daily message handling trend renders all 7 days with readable date label spacing | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| daily message handling trend renders all 30 days with readable date label spacing | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| daily message handling trend renders all 90 days with readable date label spacing | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| daily message handling trend adds daily detail to table view and does not invent a share on empty days | Retained | Pass. Covers an explicit absence/zero-denominator boundary so the result does not invent data or invalid numbers. |
| daily message handling trend renders an all-empty period without claiming a trend | Retained | Pass. Covers an explicit absence/zero-denominator boundary so the result does not invent data or invalid numbers. |
| daily message handling trend does not substitute period totals for missing daily data | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |

### tests/backend/ai-cost/message-views.test.ts

File decision: improved. Production read: app/(authenticated)/ai-cost/MessagesHandledPanel.tsx. Each rendered view has a separate presentation contract. Category-specific counts, percentages and zero-total guards protect the labels people use to interpret usage.

| Case and purpose | Decision | Verification and rationale |
| --- | --- | --- |
| messages handled views defaults to the trend and labels all five controls | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| messages handled views renders category bars against the same total | Retained | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |
| messages handled views renders a donut with visible total and accessible category counts | Retained | Pass. Uses known attendance/count inputs to verify numeric meaning, exclusions and thresholds instead of matching implementation text. |
| messages handled views renders category counts and percentages with the total in table view | Retained | Pass. Uses known attendance/count inputs to verify numeric meaning, exclusions and thresholds instead of matching implementation text. |
| messages handled views shows an empty state in trend without a chart or percentage | Retained | Pass. Covers an explicit absence/zero-denominator boundary so the result does not invent data or invalid numbers. |
| messages handled views shows an empty state in summary without a chart or percentage | Retained | Pass. Covers an explicit absence/zero-denominator boundary so the result does not invent data or invalid numbers. |
| messages handled views shows an empty state in bars without a chart or percentage | Retained | Pass. Covers an explicit absence/zero-denominator boundary so the result does not invent data or invalid numbers. |
| messages handled views shows an empty state in donut without a chart or percentage | Retained | Pass. Covers an explicit absence/zero-denominator boundary so the result does not invent data or invalid numbers. |
| messages handled views shows an empty state in table without a chart or percentage | Retained | Pass. Covers an explicit absence/zero-denominator boundary so the result does not invent data or invalid numbers. |
| messages handled views handles all-AI and all-without-AI in trend | Improved | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |
| messages handled views handles all-AI and all-without-AI in summary | Improved | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |
| messages handled views handles all-AI and all-without-AI in bars | Improved | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |
| messages handled views handles all-AI and all-without-AI in donut | Improved | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |
| messages handled views handles all-AI and all-without-AI in table | Improved | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |
| messages handled views rounds percentages consistently and formats large counts | Retained | Pass. Uses known attendance/count inputs to verify numeric meaning, exclusions and thresholds instead of matching implementation text. |

### tests/backend/ai-cost/page-auth.test.ts

File decision: retained. Production read: app/(authenticated)/ai-cost/page.tsx. Mock auth and service boundaries establish that usage is never fetched before access checks; real server markup distinguishes unique messages from AI requests.

| Case and purpose | Decision | Verification and rationale |
| --- | --- | --- |
| AI cost page authorization does not fetch usage if the session is missing | Retained | Pass. Asserts the denial result and downstream reads/writes remaining untouched at the authorization boundary. |
| AI cost page authorization does not fetch usage if the live permission is denied | Retained | Pass. Asserts the denial result and downstream reads/writes remaining untouched at the authorization boundary. |
| AI cost page authorization fetches the requested period after both checks pass | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| AI cost message breakdown shows message counts and proportions separately from AI request counts | Retained | Pass. Uses known attendance/count inputs to verify numeric meaning, exclusions and thresholds instead of matching implementation text. |
| AI cost message breakdown shows an empty tracking state without a misleading percentage | Retained | Pass. Covers an explicit absence/zero-denominator boundary so the result does not invent data or invalid numbers. |
| AI cost message breakdown shows messages handled without AI even when there are no AI calls | Retained | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |

### tests/backend/ai-cost/stats.test.ts

File decision: improved. Production read: lib/ai-cost/stats.ts and dashboard service callers. Pure numeric/date outputs define dashboard periods, database aggregate conversion, missing-cost handling and priced-call averages.

| Case and purpose | Decision | Verification and rationale |
| --- | --- | --- |
| AI cost periods accepts only the offered periods and defaults to 30 days | Improved | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| AI cost periods ends on the current Copenhagen day | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| AI cost periods finds the current and previous month across a year boundary | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| AI usage totals keeps the total unknown until any call reports a cost | Retained | Pass. Protects the distinction between reported zero, unknown cost and priced calls using real calculation or rendered output. |
| AI usage totals converts numeric database aggregates without losing reported zero costs | Added/replacement | Pass. Protects the distinction between reported zero, unknown cost and priced calls using real calculation or rendered output. |
| AI usage totals averages over priced calls only | Improved | Pass. Protects the distinction between reported zero, unknown cost and priced calls using real calculation or rendered output. |

### tests/backend/employee-stats/auth.test.ts

File decision: retained. Production read: lib/auth/employee-stats.ts and bootstrap identity helpers. Authorization results and no-role-read rejection protect the stored-role hierarchy. Initial identity tests concern bootstrap only, while runtime access uses the current role.

| Case and purpose | Decision | Verification and rationale |
| --- | --- | --- |
| employee stats role hierarchy allows ADMIN to read stats | Retained | Pass. Checks actual permission results against mocked session/stored-role boundaries; no UI or database implementation is substituted. |
| employee stats role hierarchy allows MANAGER to read stats | Retained | Pass. Checks actual permission results against mocked session/stored-role boundaries; no UI or database implementation is substituted. |
| employee stats role hierarchy rejects stats for role EMPLOYEE | Retained | Pass. Checks actual permission results against mocked session/stored-role boundaries; no UI or database implementation is substituted. |
| employee stats role hierarchy rejects stats for role null | Retained | Pass. Checks actual permission results against mocked session/stored-role boundaries; no UI or database implementation is substituted. |
| employee stats role hierarchy does not let a manager administer roles | Retained | Pass. Checks actual permission results against mocked session/stored-role boundaries; no UI or database implementation is substituted. |
| employee stats role hierarchy allows an admin to administer roles | Retained | Pass. Checks actual permission results against mocked session/stored-role boundaries; no UI or database implementation is substituted. |
| employee stats role hierarchy does not grant permanent access through the initial admin identity | Retained | Pass. Checks actual permission results against mocked session/stored-role boundaries; no UI or database implementation is substituted. |
| employee stats role hierarchy rejects an unauthenticated request before reading a role | Retained | Pass. Checks actual permission results against mocked session/stored-role boundaries; no UI or database implementation is substituted. |
| employee stats role hierarchy bootstraps only the exact verified initial admin identity | Retained | Pass. Checks exact verified Slack identity matching for initial-role bootstrap; it grants no permanent runtime bypass. |

### tests/backend/employee-stats/history.test.ts

File decision: improved. Production read: lib/employee-stats/history.ts and profile/overview callers. Explicit bucket edges, totals, norm exclusions, percentile interpolation and rank thresholds protect statistical meanings. Empty and untracked cases prevent invented attendance.

| Case and purpose | Decision | Verification and rationale |
| --- | --- | --- |
| bucketing workdays uses days for up to a fortnight | Retained | Pass. Compares actual numeric totals, bucket boundaries, profile outputs or percentile/rank values with explicit known fixtures for this scenario. |
| bucketing workdays uses weeks starting on Monday for a few months, with partial edges | Retained | Pass. Compares actual numeric totals, bucket boundaries, profile outputs or percentile/rank values with explicit known fixtures for this scenario. |
| bucketing workdays uses months once the span is longer than about 13 months | Retained | Pass. Compares actual numeric totals, bucket boundaries, profile outputs or percentile/rank values with explicit known fixtures for this scenario. |
| bucketing workdays covers every workday exactly once, whatever the granularity | Retained | Pass. Compares actual numeric totals, bucket boundaries, profile outputs or percentile/rank values with explicit known fixtures for this scenario. |
| bucketing workdays has no buckets without workdays | Retained | Pass. Compares actual numeric totals, bucket boundaries, profile outputs or percentile/rank values with explicit known fixtures for this scenario. |
| series and spread adds up several people per bucket and skips untracked days | Retained | Pass. Compares actual numeric totals, bucket boundaries, profile outputs or percentile/rank values with explicit known fixtures for this scenario. |
| series and spread interpolates quantiles | Retained | Pass. Compares actual numeric totals, bucket boundaries, profile outputs or percentile/rank values with explicit known fixtures for this scenario. |
| series and spread gives the middle half of office shares, and nothing for too few people | Retained | Pass. Compares actual numeric totals, bucket boundaries, profile outputs or percentile/rank values with explicit known fixtures for this scenario. |
| series and spread leaves out people with no working days in a bucket | Retained | Pass. Compares actual numeric totals, bucket boundaries, profile outputs or percentile/rank values with explicit known fixtures for this scenario. |
| building a profile compares a person with the other employees over the same days | Retained | Pass. Compares actual numeric totals, bucket boundaries, profile outputs or percentile/rank values with explicit known fixtures for this scenario. |
| building a profile never folds the person into their own norm | Retained | Pass. Compares actual numeric totals, bucket boundaries, profile outputs or percentile/rank values with explicit known fixtures for this scenario. |
| building a profile has no norm when asked for the individual alone, or with no colleagues | Retained | Pass. Compares actual numeric totals, bucket boundaries, profile outputs or percentile/rank values with explicit known fixtures for this scenario. |
| building a profile ranks the office share against colleagues, counting ties as half | Retained | Pass. Compares actual numeric totals, bucket boundaries, profile outputs or percentile/rank values with explicit known fixtures for this scenario. |
| building a profile does not rank without enough colleagues or without working days | Retained | Pass. Compares actual numeric totals, bucket boundaries, profile outputs or percentile/rank values with explicit known fixtures for this scenario. |
| building a profile starts at the person’s first tracked day and compares over those days only | Retained | Pass. Compares actual numeric totals, bucket boundaries, profile outputs or percentile/rank values with explicit known fixtures for this scenario. |
| building a profile keeps colleagues who joined later out of the days before they were on record | Retained | Pass. Compares actual numeric totals, bucket boundaries, profile outputs or percentile/rank values with explicit known fixtures for this scenario. |
| building a profile is empty for someone with no tracked days | Retained | Pass. Compares actual numeric totals, bucket boundaries, profile outputs or percentile/rank values with explicit known fixtures for this scenario. |
| building a profile lists the person’s days for the calendar, capped at the latest weeks | Retained | Pass. Compares actual numeric totals, bucket boundaries, profile outputs or percentile/rank values with explicit known fixtures for this scenario. |
| building a profile adds up to the same totals as tallying the person directly | Retained | Pass. Compares actual numeric totals, bucket boundaries, profile outputs or percentile/rank values with explicit known fixtures for this scenario. |

### tests/backend/employee-stats/navigation.test.ts

File decision: retained. Production read: components/layout/AppShell.tsx. Rendered links and path classification protect permission-dependent navigation and route highlighting. Hiding links complements the independently tested server authorization.

| Case and purpose | Decision | Verification and rationale |
| --- | --- | --- |
| employee stats navigation does not expose either link to ordinary users | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| employee stats navigation shows the stats link to a manager but not the access controls | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| employee stats navigation shows the access controls to the admin | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| highlighting the stats link stays on Stats for the overview and every employee page, but not for the access controls | Retained | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |

### tests/backend/employee-stats/page-auth.test.ts

File decision: improved. Production read: employee-stats page.tsx, people/page.tsx, people/[userId]/page.tsx, access/page.tsx, PersonSearch.tsx and charts.tsx. Runtime page calls protect auth gates and query forwarding. Real rendering protects linked periods, search, chart content and empty states. Profile search checks both actual page wiring and links rendered from a matching query.

| Case and purpose | Decision | Verification and rationale |
| --- | --- | --- |
| employee stats page authorization does not load stats without a session | Retained | Pass. Asserts the denial result and downstream reads/writes remaining untouched at the authorization boundary. |
| employee stats page authorization does not load stats when the live permission is denied | Retained | Pass. Asserts the denial result and downstream reads/writes remaining untouched at the authorization boundary. |
| employee stats page authorization loads the requested period and sort after both checks pass | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| employee stats page authorization ignores repeated query parameters instead of passing arrays on | Retained | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |
| employee stats page content shows the figures and each employee | Retained | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |
| employee stats page content links to the access controls only for the admin | Retained | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |
| employee stats page content shows an empty state without a division by zero | Retained | Pass. Covers an explicit absence/zero-denominator boundary so the result does not invent data or invalid numbers. |
| employee stats page content keeps the chosen sort when switching period | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| employee stats page content offers longer periods than 90 days, up to all time | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| employee stats page content labels an all-time view | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| employee stats page content draws the charts and links each employee to their own page | Retained | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |
| employee stats page content keeps the chosen period on the links to each employee | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| employee stats page content says so when no workday has started in the period | Retained | Pass. Covers an explicit absence/zero-denominator boundary so the result does not invent data or invalid numbers. |
| employee directory page does not list employees without a session or without the live permission | Retained | Pass. Asserts the denial result and downstream reads/writes remaining untouched at the authorization boundary. |
| employee directory page lists everyone with a link to their own page | Retained | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |
| employee directory page applies a search from the address, for browsers without JavaScript | Retained | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |
| employee directory page finds people whatever the case or accents, by name or email | Improved | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |
| employee directory page shows the access link only to the admin | Retained | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |
| employee profile page does not load anyone without a session or without the live permission | Retained | Pass. Asserts the denial result and downstream reads/writes remaining untouched at the authorization boundary. |
| employee profile page asks for the person, period and comparison in the address | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| employee profile page shows not found for someone who is not an active employee | Retained | Pass. Checks the rejected boundary result and, where a service is involved, the absence of an unauthorized side effect. |
| employee profile page draws every chart for the person | Retained | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |
| employee profile page compares with the norm: a norm line, a band and the gap to it | Retained | Pass. Uses known attendance/count inputs to verify numeric meaning, exclusions and thresholds instead of matching implementation text. |
| employee profile page shows only the person when asked: no norm anywhere | Retained | Pass. Covers an explicit absence/zero-denominator boundary so the result does not invent data or invalid numbers. |
| employee profile page switches between the views and periods without losing the other choice | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| employee profile page keeps comparison norm and period 90 on employee search links | Added/replacement | Pass. Uses real page-provided search props and a selected query to assert the actual destination retains both choices. |
| employee profile page keeps comparison alone and period all on employee search links | Added/replacement | Pass. Uses real page-provided search props and a selected query to assert the actual destination retains both choices. |
| employee profile page explains a missing norm instead of drawing an empty one | Retained | Pass. Covers an explicit absence/zero-denominator boundary so the result does not invent data or invalid numbers. |
| employee profile page has a clear empty state for a person without days on record | Retained | Pass. Covers an explicit absence/zero-denominator boundary so the result does not invent data or invalid numbers. |
| legacy stats access page requires a session before checking the admin role | Retained | Pass. Asserts the denial result and downstream reads/writes remaining untouched at the authorization boundary. |
| legacy stats access page rejects managers and employees before redirecting | Retained | Pass. Checks the rejected boundary result and, where a service is involved, the absence of an unauthorized side effect. |
| legacy stats access page redirects admins to application role management | Retained | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |

### tests/backend/employee-stats/sandbox.test.ts

File decision: improved. Production read: lib/auth/employee-stats.ts and lib/sandbox/profiles.ts. Fixture membership and environment-dependent identity outputs protect the local initial admin without granting sandbox access in production. Environment stubs now always restore after a failing assertion.

| Case and purpose | Decision | Verification and rationale |
| --- | --- | --- |
| employee stats admin by workspace uses an active sandbox profile as the sandbox admin | Retained | Pass. Checks concrete sandbox fixture identity and environment-dependent initial admin lookup; this does not grant runtime access from identity. |
| employee stats admin by workspace knows the admin of the real workspace and of the sandbox only | Retained | Pass. Checks concrete sandbox fixture identity and environment-dependent initial admin lookup; this does not grant runtime access from identity. |
| employee stats admin by workspace never grants admin in the sandbox workspace of a production build | Retained | Pass. Checks concrete sandbox fixture identity and environment-dependent initial admin lookup; this does not grant runtime access from identity. |

### tests/backend/employee-stats/stats.test.ts

File decision: improved. Production read: lib/employee-stats/stats.ts, format.ts, resolveWorkWeek caller contract. Literal per-status counts and dates protect business meaning. Deterministic differential cases compare optimized history resolution with the full-period path; explicit fixtures keep common mapping defects from cancelling out.

| Case and purpose | Decision | Verification and rationale |
| --- | --- | --- |
| period and sort parsing accepts only the offered periods, or all time, and falls back to 30 days | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| period and sort parsing accepts only known sorts and falls back to name | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| workdays in a period lists the calendar days ending today, oldest first | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| workdays in a period skips weekends and counts today once it is past 09:00 in Copenhagen | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| workdays in a period does not count this morning before 09:00 Copenhagen time | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| workdays in a period never counts the weekend itself, only the Friday before it | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| tallying days groups every attendance status and keeps days without a status apart | Retained | Pass. Uses known attendance/count inputs to verify numeric meaning, exclusions and thresholds instead of matching implementation text. |
| tallying days counts IN_OFFICE only in office | Added/replacement | Pass. One status per fixture prevents two wrong group assignments cancelling out in an aggregate total. |
| tallying days counts IN_LATE only in office | Added/replacement | Pass. One status per fixture prevents two wrong group assignments cancelling out in an aggregate total. |
| tallying days counts LEAVING_EARLY only in office | Added/replacement | Pass. One status per fixture prevents two wrong group assignments cancelling out in an aggregate total. |
| tallying days counts FROM_HOME only in remote | Added/replacement | Pass. One status per fixture prevents two wrong group assignments cancelling out in an aggregate total. |
| tallying days counts REMOTE only in remote | Added/replacement | Pass. One status per fixture prevents two wrong group assignments cancelling out in an aggregate total. |
| tallying days counts AT_CLIENT only in client | Added/replacement | Pass. One status per fixture prevents two wrong group assignments cancelling out in an aggregate total. |
| tallying days counts SICK only in sick | Added/replacement | Pass. One status per fixture prevents two wrong group assignments cancelling out in an aggregate total. |
| tallying days counts CHILD_SICK only in sick | Added/replacement | Pass. One status per fixture prevents two wrong group assignments cancelling out in an aggregate total. |
| tallying days counts VACATION only in vacation | Added/replacement | Pass. One status per fixture prevents two wrong group assignments cancelling out in an aggregate total. |
| tallying days counts ON_LEAVE only in other | Added/replacement | Pass. One status per fixture prevents two wrong group assignments cancelling out in an aggregate total. |
| tallying days counts AWAY only in other | Added/replacement | Pass. One status per fixture prevents two wrong group assignments cancelling out in an aggregate total. |
| tallying days counts a status without a group as no status | Retained | Pass. Uses known attendance/count inputs to verify numeric meaning, exclusions and thresholds instead of matching implementation text. |
| tallying days computes the office share over working days, ignoring absences | Retained | Pass. Uses known attendance/count inputs to verify numeric meaning, exclusions and thresholds instead of matching implementation text. |
| formatting shows N/A rather than dividing by zero | Retained | Pass. Covers an explicit absence/zero-denominator boundary so the result does not invent data or invalid numbers. |
| summarizing employees adds up the company and each weekday | Retained | Pass. Uses known attendance/count inputs to verify numeric meaning, exclusions and thresholds instead of matching implementation text. |
| summarizing employees sorts by name regardless of case, or by a group with the highest first | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| summarizing employees leaves the resolved days out of the employee rows | Retained | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |
| summarizing employees handles a period with no people or workdays | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| summarizing employees breaks ties by name and then id so the order is stable | Retained | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |
| resolving each employee’s days matches resolving the whole period at once, for many kinds of declarations | Retained | Pass. Retains deterministic full-period comparison to catch optimized status-selection errors across many declarations and days. |
| resolving each employee’s days matches over a long history, where most days have nothing declared | Retained | Pass. Retains deterministic full-period comparison to catch optimized status-selection errors across many declarations and days. |
| resolving each employee’s days treats an open-ended declaration as covering every later day | Retained | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |
| resolving each employee’s days still counts a declaration whose clock times fall on a day outside its dates | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| resolving each employee’s days keeps a newer home declaration on its own date while another day remains office attendance | Added/replacement | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| resolving each employee’s days gives a person with no declarations the workday default | Retained | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |
| resolving each employee’s days leaves the days before a person was on record untracked | Retained | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |
| resolving each employee’s days tallies only untracked-free days and keeps days without a status apart | Retained | Pass. Uses known attendance/count inputs to verify numeric meaning, exclusions and thresholds instead of matching implementation text. |
| where a person’s record starts reads database timestamps as UTC and returns the Copenhagen day | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| where a person’s record starts starts on the earlier of joining and the first announcement | Retained | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |
| where a person’s record starts spans calendar days inclusively | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| formatting gaps describes the gap to the norm in percentage points | Retained | Pass. Uses known attendance/count inputs to verify numeric meaning, exclusions and thresholds instead of matching implementation text. |

### tests/backend/message-quality/auth.test.ts

File decision: improved. Production read: lib/auth/message-review.ts and lib/auth/roles.ts. The real role reader plus SQL compilation protect active mapped workspace scope, admin-only access in both environments and fail-closed missing sessions/configuration.

| Case and purpose | Decision | Verification and rationale |
| --- | --- | --- |
| administrative message review and AI costs allows only admins in production | Retained | Pass. Checks the rejected boundary result and, where a service is involved, the absence of an unauthorized side effect. |
| administrative message review and AI costs allows only admins in development | Retained | Pass. Checks the rejected boundary result and, where a service is involved, the absence of an unauthorized side effect. |
| administrative message review and AI costs reads the role only for the requested active mapped workspace member | Added/replacement | Pass. Compiles the real SQL predicate and observes action ordering; no copied authorization implementation substitutes for production. |
| administrative message review and AI costs rejects an unauthenticated request before querying | Retained | Pass. Asserts the denial result and downstream reads/writes remaining untouched at the authorization boundary. |
| administrative message review and AI costs fails closed without an active workspace member or configured team | Retained | Pass. Checks the rejected boundary result and, where a service is involved, the absence of an unauthorized side effect. |

### tests/backend/message-quality/navigation.test.ts

File decision: retained. Production read: components/layout/AppShell.tsx. Real rendered Review and AI cost links must depend on the server-provided reviewer permission.

| Case and purpose | Decision | Verification and rationale |
| --- | --- | --- |
| message review navigation does not expose the link to ordinary users | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| message review navigation shows the link only when the server passed reviewer access | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |

### tests/backend/message-quality/page-auth.test.ts

File decision: retained. Production read: app/(authenticated)/message-quality/page.tsx. Mock service boundaries prove that unauthorized requests do not load review records and authorized requests forward the requested filters.

| Case and purpose | Decision | Verification and rationale |
| --- | --- | --- |
| message quality page authorization does not fetch review records if the session is missing | Retained | Pass. Asserts the denial result and downstream reads/writes remaining untouched at the authorization boundary. |
| message quality page authorization does not fetch review records if the live permission is denied | Retained | Pass. Asserts the denial result and downstream reads/writes remaining untouched at the authorization boundary. |
| message quality page authorization fetches filtered records after both checks pass | Retained | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |

### tests/backend/message-quality/stats.test.ts

File decision: retained. Production read: lib/message-quality/stats.ts. Literal Copenhagen calendar boundaries and conversion fractions protect original-message weeks and the pending-message denominator.

| Case and purpose | Decision | Verification and rationale |
| --- | --- | --- |
| message conversion calendar weeks keeps weekend messages in their own week instead of the next work week | Retained | Pass. Uses literal week dates or conversion counts to check Copenhagen calendar boundaries and the accepted-message denominator. |
| message conversion calendar weeks uses Copenhagen midnight across summer and winter time | Retained | Pass. Uses literal week dates or conversion counts to check Copenhagen calendar boundaries and the accepted-message denominator. |
| message conversion calendar weeks falls back for invalid dates and supports weeks spanning years | Retained | Pass. Uses literal week dates or conversion counts to check Copenhagen calendar boundaries and the accepted-message denominator. |
| message conversion calendar weeks counts one conversion per message and keeps pending in the denominator | Retained | Pass. Uses literal week dates or conversion counts to check Copenhagen calendar boundaries and the accepted-message denominator. |

### tests/backend/theme/themes.test.ts

File decision: improved. Production read: app/themes.css, lib/theme/palettes.ts and CSS token consumers in app/components. CSS is product data here. Registry completeness, real token references and contrast calculations are valid schema/accessibility checks, not proxies for unexecuted application behavior. The inline bootstrap script is executed with a small storage/document boundary.

| Case and purpose | Decision | Verification and rationale |
| --- | --- | --- |
| palette registry lists default first, with unique ids and labels | Retained | Pass. Checks the registered palette and CSS data contract; completeness checks prevent vacuous contrast loops. |
| palette registry keeps the current look as "default" and adds three more palettes | Retained | Pass. Checks the registered palette and CSS data contract; completeness checks prevent vacuous contrast loops. |
| palette registry recognises only registered ids | Improved | Pass. Checks the registered palette and CSS data contract; completeness checks prevent vacuous contrast loops. |
| themes.css defines every registered palette and nothing else | Retained | Pass. Checks the registered palette and CSS data contract; completeness checks prevent vacuous contrast loops. |
| themes.css defines the background, foreground, and action tokens consumed by the interface | Added/replacement | Pass. Checks the registered palette and CSS data contract; completeness checks prevent vacuous contrast loops. |
| themes.css default · light exists | Retained | Pass. Checks the registered palette and CSS data contract; completeness checks prevent vacuous contrast loops. |
| themes.css default · light defines exactly the same tokens as every other palette | Retained | Pass. Checks the registered palette and CSS data contract; completeness checks prevent vacuous contrast loops. |
| themes.css default · light only uses hex colours | Retained | Pass. Checks the registered palette and CSS data contract; completeness checks prevent vacuous contrast loops. |
| themes.css default · dark exists | Retained | Pass. Checks the registered palette and CSS data contract; completeness checks prevent vacuous contrast loops. |
| themes.css default · dark defines exactly the same tokens as every other palette | Retained | Pass. Checks the registered palette and CSS data contract; completeness checks prevent vacuous contrast loops. |
| themes.css default · dark only uses hex colours | Retained | Pass. Checks the registered palette and CSS data contract; completeness checks prevent vacuous contrast loops. |
| themes.css ocean · light exists | Retained | Pass. Checks the registered palette and CSS data contract; completeness checks prevent vacuous contrast loops. |
| themes.css ocean · light defines exactly the same tokens as every other palette | Retained | Pass. Checks the registered palette and CSS data contract; completeness checks prevent vacuous contrast loops. |
| themes.css ocean · light only uses hex colours | Retained | Pass. Checks the registered palette and CSS data contract; completeness checks prevent vacuous contrast loops. |
| themes.css ocean · dark exists | Retained | Pass. Checks the registered palette and CSS data contract; completeness checks prevent vacuous contrast loops. |
| themes.css ocean · dark defines exactly the same tokens as every other palette | Retained | Pass. Checks the registered palette and CSS data contract; completeness checks prevent vacuous contrast loops. |
| themes.css ocean · dark only uses hex colours | Retained | Pass. Checks the registered palette and CSS data contract; completeness checks prevent vacuous contrast loops. |
| themes.css sunset · light exists | Retained | Pass. Checks the registered palette and CSS data contract; completeness checks prevent vacuous contrast loops. |
| themes.css sunset · light defines exactly the same tokens as every other palette | Retained | Pass. Checks the registered palette and CSS data contract; completeness checks prevent vacuous contrast loops. |
| themes.css sunset · light only uses hex colours | Retained | Pass. Checks the registered palette and CSS data contract; completeness checks prevent vacuous contrast loops. |
| themes.css sunset · dark exists | Retained | Pass. Checks the registered palette and CSS data contract; completeness checks prevent vacuous contrast loops. |
| themes.css sunset · dark defines exactly the same tokens as every other palette | Retained | Pass. Checks the registered palette and CSS data contract; completeness checks prevent vacuous contrast loops. |
| themes.css sunset · dark only uses hex colours | Retained | Pass. Checks the registered palette and CSS data contract; completeness checks prevent vacuous contrast loops. |
| themes.css lavender · light exists | Retained | Pass. Checks the registered palette and CSS data contract; completeness checks prevent vacuous contrast loops. |
| themes.css lavender · light defines exactly the same tokens as every other palette | Retained | Pass. Checks the registered palette and CSS data contract; completeness checks prevent vacuous contrast loops. |
| themes.css lavender · light only uses hex colours | Retained | Pass. Checks the registered palette and CSS data contract; completeness checks prevent vacuous contrast loops. |
| themes.css lavender · dark exists | Retained | Pass. Checks the registered palette and CSS data contract; completeness checks prevent vacuous contrast loops. |
| themes.css lavender · dark defines exactly the same tokens as every other palette | Retained | Pass. Checks the registered palette and CSS data contract; completeness checks prevent vacuous contrast loops. |
| themes.css lavender · dark only uses hex colours | Retained | Pass. Checks the registered palette and CSS data contract; completeness checks prevent vacuous contrast loops. |
| themes.css gives every palette its own light and dark look | Retained | Pass. Checks the registered palette and CSS data contract; completeness checks prevent vacuous contrast loops. |
| contrast (WCAG) default · light text is readable on its backgrounds | Retained | Pass. Computed contrast protects readable text for this exact palette/mode; assertions fail on low ratios or missing colours. |
| contrast (WCAG) default · light navigation rail text is readable | Retained | Pass. Computed contrast protects readable text for this exact palette/mode; assertions fail on low ratios or missing colours. |
| contrast (WCAG) default · dark text is readable on its backgrounds | Retained | Pass. Computed contrast protects readable text for this exact palette/mode; assertions fail on low ratios or missing colours. |
| contrast (WCAG) default · dark navigation rail text is readable | Retained | Pass. Computed contrast protects readable text for this exact palette/mode; assertions fail on low ratios or missing colours. |
| contrast (WCAG) ocean · light text is readable on its backgrounds | Retained | Pass. Computed contrast protects readable text for this exact palette/mode; assertions fail on low ratios or missing colours. |
| contrast (WCAG) ocean · light navigation rail text is readable | Retained | Pass. Computed contrast protects readable text for this exact palette/mode; assertions fail on low ratios or missing colours. |
| contrast (WCAG) ocean · dark text is readable on its backgrounds | Retained | Pass. Computed contrast protects readable text for this exact palette/mode; assertions fail on low ratios or missing colours. |
| contrast (WCAG) ocean · dark navigation rail text is readable | Retained | Pass. Computed contrast protects readable text for this exact palette/mode; assertions fail on low ratios or missing colours. |
| contrast (WCAG) sunset · light text is readable on its backgrounds | Retained | Pass. Computed contrast protects readable text for this exact palette/mode; assertions fail on low ratios or missing colours. |
| contrast (WCAG) sunset · light navigation rail text is readable | Retained | Pass. Computed contrast protects readable text for this exact palette/mode; assertions fail on low ratios or missing colours. |
| contrast (WCAG) sunset · dark text is readable on its backgrounds | Retained | Pass. Computed contrast protects readable text for this exact palette/mode; assertions fail on low ratios or missing colours. |
| contrast (WCAG) sunset · dark navigation rail text is readable | Retained | Pass. Computed contrast protects readable text for this exact palette/mode; assertions fail on low ratios or missing colours. |
| contrast (WCAG) lavender · light text is readable on its backgrounds | Retained | Pass. Computed contrast protects readable text for this exact palette/mode; assertions fail on low ratios or missing colours. |
| contrast (WCAG) lavender · light navigation rail text is readable | Retained | Pass. Computed contrast protects readable text for this exact palette/mode; assertions fail on low ratios or missing colours. |
| contrast (WCAG) lavender · dark text is readable on its backgrounds | Retained | Pass. Computed contrast protects readable text for this exact palette/mode; assertions fail on low ratios or missing colours. |
| contrast (WCAG) lavender · dark navigation rail text is readable | Retained | Pass. Computed contrast protects readable text for this exact palette/mode; assertions fail on low ratios or missing colours. |
| token usage only references --office-* tokens that every palette defines | Retained | Pass. Cross-checks real consumer token names against the palette schema, catching unresolved CSS variables. |
| palette init script restores a saved palette before first paint | Improved | Pass. Executes the shipped bootstrap script and checks its actual document effect for this storage condition. |
| palette init script leaves the default look when nothing valid is saved | Improved | Pass. Executes the shipped bootstrap script and checks its actual document effect for this storage condition. |
| palette init script survives blocked storage | Retained | Pass. Executes the shipped bootstrap script and checks its actual document effect for this storage condition. |

### tests/backend/week/ai-indicator.test.ts

File decision: retained. Production read: Status.tsx, AIIndicator.tsx and ProfileListItem.tsx. Real server markup protects accessible imported-status attribution in the reusable primitive and composed profile view, including exactly one announcement indicator.

| Case and purpose | Decision | Verification and rationale |
| --- | --- | --- |
| AI attribution labels imported statuses when asLabel is true | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| AI attribution labels imported statuses when asLabel is false | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| AI attribution does not mark manually selected statuses with source null | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| AI attribution does not mark manually selected statuses with source undefined | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| AI attribution shows one indicator for an imported FROM_HOME profile announcement, rather than repeating it on dates | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| AI attribution shows one indicator for an imported IN_OFFICE profile announcement, rather than repeating it on dates | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| AI attribution shows one indicator for an imported null profile announcement, rather than repeating it on dates | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |

### tests/backend/week/attendance-grouping.test.ts

File decision: retained. Production read: components/week/WeekOverview.tsx, presence.ts and PinnedColleagues.tsx. Real rendering checks group membership, order, counts and selected-day semantics. Sidebar cases independently protect the private pinned list and live-count presentation.

| Case and purpose | Decision | Verification and rationale |
| --- | --- | --- |
| attendance groups splits each exact resolved status into a counted group in canonical order | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| attendance groups preserves directory order and pins the signed-in person first inside a group | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| attendance groups leaves colleagues out of the sidebar unless they are pinned | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| attendance groups keeps Note distinct from No status and omits empty groups | Retained | Pass. Covers an explicit absence/zero-denominator boundary so the result does not invent data or invalid numbers. |
| attendance groups groups by the selected day status, not profile status or another day | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| attendance groups keeps week-wide exceptions visible in the selected-day In office or No status group | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| pinned colleagues in the sidebar lists pinned colleagues with in-office people first, then by pin order | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| pinned colleagues in the sidebar shows how many pinned colleagues are in and who is arriving later | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| pinned colleagues in the sidebar omits the arriving note when nobody is late | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| pinned colleagues in the sidebar offers editing only once something is pinned | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| pinned colleagues in the sidebar ignores pins for people who are no longer in the directory or are the viewer | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| pinned colleagues in the sidebar shows the status on the selected day, not on other days | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| pinned colleagues in the sidebar keeps a colleague with no status on the day at the end | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |

### tests/backend/week/cache-tag.test.ts

File decision: retained. Production read: lib/services/weekOverviewCache.ts and cache invalidation callers. The cache API is the boundary: the shared tag must be invalidated, only the documented missing-context error may be swallowed, and real errors must propagate.

| Case and purpose | Decision | Verification and rationale |
| --- | --- | --- |
| invalidates the tag shared by every week/day variant | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| allows standalone seed scripts without a Next cache context | Retained | Pass. Exercises the real caller against its cache/storage boundary and checks externally meaningful results and ordering. |
| propagates other invalidation failures | Retained | Pass. Exercises the real caller against its cache/storage boundary and checks externally meaningful results and ordering. |

### tests/backend/week/colleague-status.test.ts

File decision: improved. Production read: app/actions/statusActions.ts and WeekOverview.tsx. Real plan validation and action flow with mocked auth/storage protect caller attribution, permissions and no-write denials. Rendered planning controls protect the admin capability passed into the board. Fixed time removes wall-clock dependence.

| Case and purpose | Decision | Verification and rationale |
| --- | --- | --- |
| setting a colleague’s status saves the plan on the colleague’s behalf for an admin | Improved | Pass. Exercises the real action and plan validation against mocked authorization/persistence, checking the correct target and saved declaration data. |
| setting a colleague’s status refuses managers and employees | Improved | Pass. Checks the rejected boundary result and, where a service is involved, the absence of an unauthorized side effect. |
| setting a colleague’s status refuses people outside the active workspace | Improved | Pass. Checks the rejected boundary result and, where a service is involved, the absence of an unauthorized side effect. |
| setting a colleague’s status rejects a non-string colleague id | Improved | Pass. Checks the rejected boundary result and, where a service is involved, the absence of an unauthorized side effect. |
| setting a colleague’s status rejects unauthenticated requests before checking permissions or saving | Added/replacement | Pass. Asserts the denial result and downstream reads/writes remaining untouched at the authorization boundary. |
| setting a colleague’s status rejects an invalid plan without writing a colleague declaration | Added/replacement | Pass. Checks the rejected boundary result and, where a service is involved, the absence of an unauthorized side effect. |
| setting a colleague’s status keeps saving the signed-in person’s own plan without an admin check | Improved | Pass. Exercises the real action and plan validation against mocked authorization/persistence, checking the correct target and saved declaration data. |
| week board planning buttons lets an admin plan a colleague’s days from the board | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| week board planning buttons shows colleagues’ cells read-only to everyone else | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |

### tests/backend/week/date-navigation.test.ts

File decision: retained. Production read: WeekOverview.tsx and lib/status/week.ts. Rendered destinations, headings, dates and counts protect calendar navigation through month/year/DST boundaries. Repeated navigation follows the actual emitted link rather than duplicating date arithmetic.

| Case and purpose | Decision | Verification and rationale |
| --- | --- | --- |
| date navigation in WeekOverview moves the reported Wednesday 14 October back to Tuesday 13 October and forward to Thursday | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| date navigation in WeekOverview uses selected-day routes and labels for previous, today, and next | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| date navigation in WeekOverview navigates one calendar day around 2026-01-01 | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| date navigation in WeekOverview navigates one calendar day around 2026-03-01 | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| date navigation in WeekOverview navigates one calendar day around 2026-10-25 | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| date navigation in WeekOverview navigates one calendar day around 2027-01-01 | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| date navigation in WeekOverview keeps single-day mode through repeated navigation from 2026-10-16 | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| date navigation in WeekOverview keeps single-day mode through repeated navigation from 2026-12-30 | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| date navigation in WeekOverview uses the selected historical date for the title, subtitle, grid, counts, and panel | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| date navigation in WeekOverview keeps week navigation at seven days and the Today link at /today | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| date navigation in WeekOverview marks Today only when the single displayed date is the actual current date | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |

### tests/backend/week/new-since-last-look.test.ts

File decision: improved. Production read: components/week/presence.ts, WeekOverview.tsx and layoutPreference.ts. Explicit announcement timestamps and rendered order protect newest-first news, self-exclusion, first visits and persistent layout choice. Exact boundary and retained-announcement cases distinguish seen updates from new ones.

| Case and purpose | Decision | Verification and rationale |
| --- | --- | --- |
| announcedSince returns the newest exception announced after the last look on the given days | Retained | Pass. Compares the actual newest exception timestamp or null result, including displayed-day scope and strict last-look cutoff. |
| announcedSince treats the last-look boundary as seen and reads retained daily announcements after arrival | Added/replacement | Pass. Compares the actual newest exception timestamp or null result, including displayed-day scope and strict last-look cutoff. |
| announcedSince ignores in-office declarations and Workday Defaults | Retained | Pass. Compares the actual newest exception timestamp or null result, including displayed-day scope and strict last-look cutoff. |
| new since you last looked leads the board with colleagues announced since, newest first, and keeps their groups | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| new since you last looked shows no new group before the last look is known or when nothing is newer | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| chronological layout lists everyone newest first, with what is new since the last look on top | Retained | Pass. Checks concrete server-readable preference values and visible initial choice rather than a source-text declaration. |
| chronological layout is one newest-first list when nothing is new | Retained | Pass. Checks concrete server-readable preference values and visible initial choice rather than a source-text declaration. |
| chronological layout defaults to grouped and remembers the choice in a cookie | Retained | Pass. Checks concrete server-readable preference values and visible initial choice rather than a source-text declaration. |

### tests/backend/week/side-panel-toggle.test.ts

File decision: improved. Production read: WeekOverview.tsx, panelPreference.ts and scopePreference.ts. Real markup protects expanded state, panel visibility and shared toolbar membership. Cookie outputs protect server-readable site-wide persistence. These render tests cover initial state; client toggle interaction is outside their assertion scope.

| Case and purpose | Decision | Verification and rationale |
| --- | --- | --- |
| side panel toggle shows the panel by default, with a toggle that controls it | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| side panel toggle renders no panel and gives the board the full width when closed | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| side panel toggle keeps the toggle in the toolbar next to the attendance view switch | Improved | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| side panel preference is open unless explicitly closed | Retained | Pass. Checks concrete server-readable preference values and visible initial choice rather than a source-text declaration. |
| side panel preference remembers open=true in a year-long cookie readable by the whole site | Retained | Pass. Checks concrete server-readable preference values and visible initial choice rather than a source-text declaration. |
| side panel preference remembers open=false in a year-long cookie readable by the whole site | Retained | Pass. Checks concrete server-readable preference values and visible initial choice rather than a source-text declaration. |
| remembered day or week is a single day unless the cookie says week | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| remembered day or week remembers day in a year-long site-wide cookie | Retained | Pass. Checks concrete server-readable preference values and visible initial choice rather than a source-text declaration. |
| remembered day or week remembers week in a year-long site-wide cookie | Retained | Pass. Checks concrete server-readable preference values and visible initial choice rather than a source-text declaration. |

### tests/backend/week/status-cache-invalidation.test.ts

File decision: improved. Production read: lib/services/statusService.ts and weekOverviewCache.ts. Mock database/cache/broadcast boundaries protect commit-before-invalidate-before-send ordering and the distinctions between changed, unchanged and failed writes. Broadcast assertions prevent a missing notification from passing.

| Case and purpose | Decision | Verification and rationale |
| --- | --- | --- |
| manual status cache invalidation invalidates after a successful write and before broadcast [createNewStatus] | Improved | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| manual status cache invalidation invalidates after a successful write and before broadcast [updateStatusByUserUserId] | Improved | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| manual status cache invalidation invalidates after a successful write and before broadcast [deleteStatusById] | Improved | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| manual status cache invalidation invalidates after a successful write and before broadcast [deleteStatusByUserUserId] | Improved | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| manual status cache invalidation does not invalidate failed writes [createNewStatus] | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| manual status cache invalidation does not invalidate failed writes [updateStatusByUserUserId] | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| manual status cache invalidation does not invalidate failed writes [deleteStatusById] | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| manual status cache invalidation does not invalidate failed writes [deleteStatusByUserUserId] | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| manual status cache invalidation does not invalidate when no rows changed [createNewStatus] | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| manual status cache invalidation does not invalidate when no rows changed [updateStatusByUserUserId] | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| manual status cache invalidation does not invalidate when no rows changed [deleteStatusById] | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| manual status cache invalidation does not invalidate when no rows changed [deleteStatusByUserUserId] | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| manual status cache invalidation invalidates corrections only when changed=false after commit | Improved | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| manual status cache invalidation invalidates corrections only when changed=true after commit | Improved | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |

### tests/backend/week/today-page.test.ts

File decision: improved. Production read: app/(authenticated)/today/page.tsx and WeekOverviewWrapper.tsx props contract. Calling the real server page protects authentication order, day/week selection, browser preferences, personal pins and plans, live admin permission and remount keys. Data sources stay at mocked boundaries.

| Case and purpose | Decision | Verification and rationale |
| --- | --- | --- |
| /today page days authenticates before reading cookies, shared attendance, plans, pins, or roles | Added/replacement | Pass. Asserts the denial result and downstream reads/writes remaining untouched at the authorization boundary. |
| /today page days passes the live admin permission false to the board for the signed-in person | Added/replacement | Pass. Calls the real server page and checks service inputs or returned wrapper props/key for this date, preference or permission. |
| /today page days passes the live admin permission true to the board for the signed-in person | Added/replacement | Pass. Calls the real server page and checks service inputs or returned wrapper props/key for this date, preference or permission. |
| /today page days passes only Copenhagen today for the default route at 2026-09-26T10:00:00Z, including a weekend | Retained | Pass. Calls the real server page and checks service inputs or returned wrapper props/key for this date, preference or permission. |
| /today page days passes only Copenhagen today for the default route at 2026-09-25T22:30:00Z, including a weekend | Retained | Pass. Calls the real server page and checks service inputs or returned wrapper props/key for this date, preference or permission. |
| /today page days keeps five days for an explicit week query | Retained | Pass. Calls the real server page and checks service inputs or returned wrapper props/key for this date, preference or permission. |
| /today page days loads and retains the requested single day 2026-10-13 on page reload | Retained | Pass. Calls the real server page and checks service inputs or returned wrapper props/key for this date, preference or permission. |
| /today page days loads and retains the requested single day 2026-10-18 on page reload | Retained | Pass. Calls the real server page and checks service inputs or returned wrapper props/key for this date, preference or permission. |
| /today page days loads and retains the requested single day 2026-12-31 on page reload | Retained | Pass. Calls the real server page and checks service inputs or returned wrapper props/key for this date, preference or permission. |
| /today page days loads and retains the requested single day 2027-01-01 on page reload | Retained | Pass. Calls the real server page and checks service inputs or returned wrapper props/key for this date, preference or permission. |
| /today page days falls back to Copenhagen today for invalid day input 2026-02-31 | Retained | Pass. Calls the real server page and checks service inputs or returned wrapper props/key for this date, preference or permission. |
| /today page days falls back to Copenhagen today for invalid day input not-a-date | Retained | Pass. Calls the real server page and checks service inputs or returned wrapper props/key for this date, preference or permission. |
| /today page days falls back to Copenhagen today for invalid day input 2026-10-13 | Retained | Pass. Calls the real server page and checks service inputs or returned wrapper props/key for this date, preference or permission. |
| /today page days loads the signed-in person’s pinned colleagues for the board | Retained | Pass. Calls the real server page and checks service inputs or returned wrapper props/key for this date, preference or permission. |
| /today page days opens the side panel unless the visitor closed it | Retained | Pass. Calls the real server page and checks service inputs or returned wrapper props/key for this date, preference or permission. |
| /today page days starts grouped unless the visitor chose the chronological list | Retained | Pass. Calls the real server page and checks service inputs or returned wrapper props/key for this date, preference or permission. |
| /today page days remembered day or week sends a plain visit to the current work week when the visitor last looked at a week | Retained | Pass. Calls the real server page and checks service inputs or returned wrapper props/key for this date, preference or permission. |
| /today page days remembered day or week opens today for the day scope | Retained | Pass. Calls the real server page and checks service inputs or returned wrapper props/key for this date, preference or permission. |
| /today page days remembered day or week opens today for the garbage scope | Retained | Pass. Calls the real server page and checks service inputs or returned wrapper props/key for this date, preference or permission. |
| /today page days remembered day or week keeps an explicit day even when the visitor last looked at a week | Retained | Pass. Calls the real server page and checks service inputs or returned wrapper props/key for this date, preference or permission. |
| /today page days keeps week mode when both query parameters are present | Retained | Pass. Calls the real server page and checks service inputs or returned wrapper props/key for this date, preference or permission. |
| /today page days remounts between live today, explicit today, and a different day in the same week | Retained | Pass. Calls the real server page and checks service inputs or returned wrapper props/key for this date, preference or permission. |
| /today page days remounts when switching between a single Monday and its full week | Retained | Pass. Calls the real server page and checks service inputs or returned wrapper props/key for this date, preference or permission. |

### tests/backend/week/today-refresh.test.ts

File decision: retained. Production read: app/actions/userActions.ts. Real action calls protect Copenhagen rollover, explicit historical dates/week mode and auth-before-shared-cache access.

| Case and purpose | Decision | Verification and rationale |
| --- | --- | --- |
| week overview refresh action loads only Copenhagen today when refreshing without a week | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| week overview refresh action refreshes the Copenhagen date across midnight and a new work week | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| week overview refresh action keeps the explicit five-day week when refreshing a requested week | Retained | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |
| week overview refresh action refreshes the requested single day without returning to today, including across midnight | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| week overview refresh action authenticates every refresh before reading shared cached data | Retained | Pass. Asserts the denial result and downstream reads/writes remaining untouched at the authorization boundary. |
| week overview refresh action validates a requested day before loading attendance | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |

### tests/backend/week/week-cache.test.ts

File decision: improved. Production read: lib/services/weekOverviewQuery.ts and real Next unstable_cache. A memory storage adapter exercises real cache keying, serialization and expiry. Restored date fields are checked on both misses/hits, with null and absent-week controls.

| Case and purpose | Decision | Verification and rationale |
| --- | --- | --- |
| shared week query cache reuses identical day inputs for five minutes and separates day/week variants | Improved | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| shared week query cache restores status timestamps on both misses and JSON cache hits | Improved | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |

### tests/backend/week/week-overview-rendering.test.ts

File decision: retained. Production read: WeekOverview.tsx, ProfileListItem.tsx, StatusEmoji.tsx and resolveWorkWeek. These composed runtime render contracts protect exception visibility, office totals, timed declarations, notes, emojis and colleague attribution. Primitive tests remain useful because the board integrates them differently.

| Case and purpose | Decision | Verification and rationale |
| --- | --- | --- |
| status labels in the week grid and the sidebar marks an imported FROM_HOME announcement only in the grid | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| status labels in the week grid and the sidebar marks an imported IN_LATE announcement only in the grid | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| status labels in the week grid and the sidebar marks an imported null announcement only in the grid | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| status labels in the week grid and the sidebar announces AI involvement on the signed-in person’s planning button | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| status labels in the week grid and the sidebar leaves manually announced statuses unmarked | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| status labels in the week grid and the sidebar displays IN_LATE in the grid and keeps it out of the sidebar | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| status labels in the week grid and the sidebar displays LEAVING_EARLY in the grid and keeps it out of the sidebar | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| status labels in the week grid and the sidebar displays FROM_HOME in the grid and keeps it out of the sidebar | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| status labels in the week grid and the sidebar displays REMOTE in the grid and keeps it out of the sidebar | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| status labels in the week grid and the sidebar displays AT_CLIENT in the grid and keeps it out of the sidebar | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| status labels in the week grid and the sidebar displays SICK in the grid and keeps it out of the sidebar | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| status labels in the week grid and the sidebar displays CHILD_SICK in the grid and keeps it out of the sidebar | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| status labels in the week grid and the sidebar displays VACATION in the grid and keeps it out of the sidebar | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| status labels in the week grid and the sidebar displays ON_LEAVE in the grid and keeps it out of the sidebar | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| status labels in the week grid and the sidebar displays AWAY in the grid and keeps it out of the sidebar | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| status labels in the week grid and the sidebar keeps office attendance with id 0 out of the grid but counts it | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| status labels in the week grid and the sidebar keeps office attendance with id 7 out of the grid but counts it | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| status labels in the week grid and the sidebar omits colleagues with no resolved status from both areas | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| status labels in the week grid and the sidebar retains the IN_LATE label alongside its arrival time and details | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| status labels in the week grid and the sidebar retains the LEAVING_EARLY label alongside its arrival time and details | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| status labels in the week grid and the sidebar leaves office cells blank while preserving the planning button | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| status labels in the week grid and the sidebar leaves days without a status blank | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| status labels in the week grid and the sidebar groups late arrivals and early departures separately | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| status labels in the week grid and the sidebar retains description-only announcements in the grid | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| attendance view links offers only Today and Week and marks the current mode | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| attendance view links includes people with an exception on any week day and shows only pinned colleagues in the sidebar | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| attendance view links keeps a week row with an exception on another day but omits it from today’s sidebar | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| today-only attendance renders one day column and the Today heading | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| today-only attendance keeps IN_OFFICE out of the grid and counts it in the sidebar, including assumed attendance | Retained | Pass. Uses known attendance/count inputs to verify numeric meaning, exclusions and thresholds instead of matching implementation text. |
| today-only attendance invites the viewer to pin colleagues when none are pinned | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| today-only attendance shows declared attendance exceptions in the grid, not the sidebar [IN_LATE] | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| today-only attendance shows declared attendance exceptions in the grid, not the sidebar [LEAVING_EARLY] | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| today-only attendance shows declared attendance exceptions in the grid, not the sidebar [FROM_HOME] | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| today-only attendance shows declared attendance exceptions in the grid, not the sidebar [REMOTE] | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| today-only attendance shows declared attendance exceptions in the grid, not the sidebar [AT_CLIENT] | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| today-only attendance shows declared attendance exceptions in the grid, not the sidebar [SICK] | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| today-only attendance shows declared attendance exceptions in the grid, not the sidebar [CHILD_SICK] | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| today-only attendance shows declared attendance exceptions in the grid, not the sidebar [description-only note] | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| today-only attendance shows declared attendance exceptions in the grid, not the sidebar [VACATION] | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| today-only attendance shows declared attendance exceptions in the grid, not the sidebar [ON_LEAVE] | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| today-only attendance shows declared attendance exceptions in the grid, not the sidebar [AWAY] | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| today-only attendance uses the selected date status rather than a different day or the profile status | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| today-only attendance looks up today by date when the profile still has a full week of statuses | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| today-only attendance keeps exceptions in the grid and shows pinned colleagues’ status on an earlier day | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| today-only attendance ignores an exception declared for 2026-09-21 when today defaults to office | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| today-only attendance ignores an exception declared for 2026-09-23 when today defaults to office | Retained | Pass. Renders the real composed UI and checks the promised membership, order, counts or accessible state for this scenario. |
| today-only attendance shows only today’s note for a declaration spanning multiple days | Retained | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |
| daily announcement visibility after arrival retains the announcement and live office count at 07:29:59 | Retained | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |
| daily announcement visibility after arrival retains the announcement and live office count at 07:30:00 | Retained | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |
| daily announcement visibility after arrival retains the announcement and live office count at 15:00:00 | Retained | Pass. Direct runtime output/call assertions protect this named behavior; mocks stay at service, session, router or storage boundaries. |
| status emoji presentation shows the persisted vacation emoji beside readable labels in the board | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| status emoji presentation gives manual declarations a default emoji without changing their note | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| status emoji presentation shows the chosen emoji once in the person details status, alongside dates and notes | Retained | Pass. Uses concrete dates or emitted destinations to protect calendar selection, boundary handling and persisted view inputs. |
| status emoji presentation leaves notes and missing statuses without an attendance emoji | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| shared announcement attribution shows the source author in person details and the week tooltip: Ulla | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| shared announcement attribution shows the source author in person details and the week tooltip: null | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |
| shared announcement attribution leaves self-authored and manual status details without colleague attribution | Retained | Pass. Checks runtime accessible/readable presentation and the presence or absence of imported/decorative attribution. |

### tests/backend/week/week-overview.test.ts

File decision: retained. Production read: components/week/presence.ts and resolveWorkWeek. Literal segments and readable time/range notes protect multi-day bars and Copenhagen arrival presentation.

| Case and purpose | Decision | Verification and rationale |
| --- | --- | --- |
| week board cells merges a multi-day declaration into one bar and notes when it ends | Retained | Pass. Checks actual segment offsets/spans and note strings from the pure presentation helpers using concrete declaration dates/times. |
| week board cells notes a declaration that started before the visible week | Retained | Pass. Checks actual segment offsets/spans and note strings from the pure presentation helpers using concrete declaration dates/times. |
| week board cells shows arrival times, including approximate ones | Retained | Pass. Checks actual segment offsets/spans and note strings from the pure presentation helpers using concrete declaration dates/times. |

### tests/backend/week/week-view.test.ts

File decision: retained. Production read: lib/status/week.ts and WeekOverviewWrapper view callers. Pure URL resolution outputs protect live-today defaults, valid explicit days, Monday normalization and week precedence.

| Case and purpose | Decision | Verification and rationale |
| --- | --- | --- |
| resolveWeekView follows today when the URL names no day or week | Retained | Pass. Compares the actual resolved URL view object with the requested day/week/default contract. |
| resolveWeekView snaps a week to its Monday | Retained | Pass. Compares the actual resolved URL view object with the requested day/week/default contract. |
| resolveWeekView keeps an explicit day and lets the week win over it | Retained | Pass. Compares the actual resolved URL view object with the requested day/week/default contract. |
| resolveWeekView falls back to the current week or day for invalid values | Retained | Pass. Compares the actual resolved URL view object with the requested day/week/default contract. |

### components/ui/Button/Tests/ButtonTest/ButtonTest.stories.tsx

File decision: improved. Production read: components/ui/Button/Button.tsx, LoginForm, StatusForm and SetStatusStep callers. Browser verification: passed in the CI Storybook runner, including axe checks.

| Story | Decision and purpose | Rationale |
| --- | --- | --- |
| ButtonClickTests | Improved, mouse and keyboard activation | A spy observes callback counts directly. Removing the runtime callback fails this exact story. No shared-root DOM mutation or success-text proxy remains. |
| ButtonChildrenTests | Improved, visible children and safe default button type | Accessible role/name, type=button and enabled state protect ordinary call sites from accidental form submission. |
| ButtonLargeVariantTests | Retained/improved, large styling and accessible label | w-full is the explicit large-variant visual contract; role/name and visible text verify usable labeling. |
| ButtonPropsPresentTest | Improved, explicit submit type and label precedence | Exercises caller-provided props and ensures label overrides children in the actual rendered button. |
| LoadingPreventsSubmission | Added, disabled busy button | Native click cannot invoke the callback while disabled, and aria-busy announces loading. |

### components/ui/Button/Tests/ButtonLinkTest/ButtonLinkTest.stories.tsx

File decision: improved. Production read: the link branch of components/ui/Button/Button.tsx. Browser verification: passed in the CI Storybook runner, including axe checks.

| Story | Decision and purpose | Rationale |
| --- | --- | --- |
| ButtonLinkPropsPresent | Improved, accessible link destination/target and label precedence | Checks actual link semantics, enabled tab stop, explicit target and absence of an accidental button. |
| LinkUsesChildren | Added, children-only link/default target | Covers the second supported link condition and same-window navigation. |
| LoadingLinkLeavesTabOrder | Added, disabled link semantics | Checks aria-disabled and tabindex=-1 while retaining visible text. It does not claim browser-native link disabling. |
| MissingDestinationUsesButton | Added, incomplete link props fallback | A missing href must produce a button rather than an unusable anchor. |
