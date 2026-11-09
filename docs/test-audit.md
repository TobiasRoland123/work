# Repository unit-test audit

Audit date: 2026-11-09. Production behavior is unchanged. The checkout was clean before
this work. The supplied AGENTS instructions were followed; no additional AGENTS.md files
were found in the checkout or its parent directories.

## Scope and repository context

The original inventory contains 96 backend test files: 79 unit/component/adapter files
in scope and 17 real PostgreSQL integration files outside the requested unit-test audit.
Two assertion-bearing Storybook files are also in scope, despite their `.stories.tsx`
names. That makes 81 original files requiring case-by-case review. One PostgreSQL file
was added to replace test-local query simulation with execution of the production query.

The inventory used tracked filenames, recursive file discovery, imports of Vitest,
Playwright and Storybook test helpers, test declarations, story `play` functions, and
skip/todo/only/runIf declarations. Generated output, node_modules, dependency tests, and
Git metadata were excluded. No additional unit tests were found outside the files in
the ledgers below. Search hits such as regular-expression `.test()` in production code
are not test declarations.

- The app uses Next.js, React, Drizzle/PostgreSQL and Slack ingestion. `CONTEXT.md`
  supplies the attendance, declaration, correction, sandbox, and palette vocabulary.
- `vitest.config.ts` defines a Node backend project matching `tests/backend/**/*.test.ts`
  and a Chromium Storybook project. Unit/component tests include server-rendered markup,
  real service-worker execution in a VM, isolated subprocesses, and external-boundary mocks.
- Shared Vitest setup is `.storybook/vitest.setup.ts`; Storybook previews/decorators are
  in `.storybook/preview.ts`. Backend tests mostly keep their fixture factories in the
  file that uses them. There was no global backend test utility layer to consolidate.
- `.storybook/test-runner.ts` adds axe accessibility checks to the separate Storybook
  runner. Five other story files contain presentation examples rather than authored
  unit assertions. Their smoke rendering is still exercised during final browser checks.
- `playwright.config.ts`, `tests/global-setup.ts` and `db/seed-test-user.ts` support the
  application E2E suites. They are not unit tests.

## Audit ledger

These linked ledgers contain file dispositions, individual case purposes, removed-test
rationale, verification and mutation evidence. Parameterized cases are reviewed as
individual scenarios, not merely as one declaration. A retained disposition means the
existing assertions already protect a specific contract, not that the file was only run.

- [Infrastructure ledger](test-audit-infrastructure.md): database configuration, local
  bootstrap, test schema setup and migration decisions/reading.
- [Core ledger](test-audit-core.md): attendance resolution, auth, sandbox, PWA, fetchers,
  SQL candidate selection and small shared utilities.
- [Slack ledger](test-audit-slack.md): external API adapters, extraction validation,
  shorthand, installation security, queueing, usage recording and cache invalidation.
- [Presentation ledger](test-audit-presentation.md): week controls/rendering, admin and
  restricted dashboards, stats, theme contracts and authored Button story assertions.

The complete file index and final verification summary are included below.

## Baseline

`pnpm install --frozen-lockfile --ignore-scripts` installed the lockfile versions into this
worktree. The initial offline attempt lacked one package, so the locked install used
network access. No dependency manifest or lockfile changed.

A sandbox-only run passed 882 tests, failed 17 and skipped 133. Child-process and local
network restrictions caused 15 failures; two additional database suites could not run
their setup. This is an environment-limited run, not the authoritative code baseline.

The authoritative unmodified run used a new disposable PostgreSQL 16 container, local
port 55439, database `work_slack_test`, and the repository's `db:prepare-test` command.
With `SLACK_TEST_DATABASE=1`, it collected all 96 backend files and ran 1,032 tests:
1,030 passed, two failed, none skipped. Lint and TypeScript both passed.

Both pre-existing failures were in `slack/week-cache-invalidation.test.ts`, at retry
attempts 0 and 2. Its wholesale extraction-module mock omitted `slackMentionIds`, so
processing failed before the commit/invalidation path. A partial mock now preserves
that real helper. No production change or weakened expectation was needed.

The original Storybook Vitest project discovered zero tests and exited 1. Its project
configuration excluded `**/*.stories.tsx`, including every authored component test.
Temporarily removing that exclusion restored discovery but exposed two further pre-existing
incompatibilities: Next's string-list PostCSS config is not accepted by Vite, and the
experimental Next/Vite setup cannot resolve `sb-original/image-context`. The public
Next/Vite plugin itself imports `next/dist/build/webpack/plugins/define-env-plugin.js`,
which is absent from the locked Next version. A test-only PostCSS override resolved the
first problem; the framework dependency mismatch remains. All temporary runner changes
were reverted, leaving `vitest.config.ts` unchanged. This optional Vitest browser runner
remains blocked, and is not reported as validated.

The repository's actual CI path, the standalone Webpack Storybook build and test-runner,
executes all 29 stories successfully, including every one of the nine authored component
cases and the axe checks. Thus no in-scope authored test is unexecuted. Fixing the optional
Vite integration requires a separate compatible framework/dependency decision. Current
[Storybook 8.6.14 setup documentation](https://github.com/storybookjs/storybook/blob/v8.6.14/docs/_snippets/vitest-plugin-vitest-workspace.md)
and [Vite's inline PostCSS documentation](https://github.com/vitejs/vite/blob/v6.4.5/docs/config/shared-options.md)
were checked through Context7 during this investigation.

## Local and CI commands

- Backend: `pnpm exec vitest run --project backend`; `pnpm test:backend` is its watch-capable
  package alias. Database integration cases need a disposable schema; 14 original files
  additionally require `SLACK_TEST_DATABASE=1` and verify the dedicated local target.
- All Vitest projects: `pnpm exec vitest run`; browser project alone:
  `pnpm exec vitest run --project storybook`.
- GitHub CI: install locked dependencies, `pnpm lint`, `pnpm exec tsc --noEmit`, prepare
  PostgreSQL with `NODE_ENV=test pnpm db:prepare-test`, then `pnpm test:backend`.
- GitHub's component-change job and Azure CI: install Playwright, `pnpm build-storybook --quiet`,
  serve the static build, and run `pnpm test-storybook`. The latter uses the axe hook.
- E2E: `pnpm test:e2e` seeds an app user and runs `tests/e2e.test.ts`.
  `tests/navigation.test.ts` is discoverable through Playwright but omitted by that explicit
  package command. Its prefetch case skips without `PLAYWRIGHT_PRODUCTION=1`.
- The pre-commit hook runs lint-staged: ESLint for scripts, a TypeScript check, and Prettier
  for app files. Final audit validation also checks changed-test formatting and `git diff --check`.

CI does not currently set `SLACK_TEST_DATABASE=1`, so it skips the 14 opt-in database files.
This audit enabled them locally. The new query integration file follows that existing
opt-in convention. Storybook preview marks accessibility diagnostics as `todo`, whereas
its standalone test-runner actively checks axe rules. No unit tests are explicitly skipped
or marked todo.

## Exclusions

The following original files were classified by their real dependencies and left unchanged.
They were not claimed as unit-test reviews. All PostgreSQL files still participated in the
baseline and final backend validation.

| File                                                                    | Disposition                                                | Reason                                                                                |
| ----------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `tests/backend/admin-status-change/service.integration.test.ts`         | Excluded, retained unchanged                               | Real PostgreSQL integration, not a unit test.                                         |
| `tests/backend/ai-cost/service.integration.test.ts`                     | Excluded, retained unchanged                               | Real PostgreSQL integration, not a unit test.                                         |
| `tests/backend/db-integration.test.ts`                                  | Excluded, retained unchanged                               | Real PostgreSQL integration, not a unit test.                                         |
| `tests/backend/db-migrations/runner.integration.test.ts`                | Excluded, retained unchanged                               | Real PostgreSQL integration, not a unit test.                                         |
| `tests/backend/employee-stats/service.integration.test.ts`              | Excluded, retained unchanged                               | Real PostgreSQL integration, not a unit test.                                         |
| `tests/backend/lib/services/statusService.test.ts`                      | Excluded, retained unchanged                               | Real PostgreSQL integration, not a unit test.                                         |
| `tests/backend/lib/services/userService.test.ts`                        | Excluded, retained unchanged                               | Real PostgreSQL integration, not a unit test.                                         |
| `tests/backend/message-quality/actions.integration.test.ts`             | Excluded, retained unchanged                               | Real PostgreSQL integration, not a unit test.                                         |
| `tests/backend/message-quality/migration.integration.test.ts`           | Excluded, retained unchanged                               | Real PostgreSQL integration, not a unit test.                                         |
| `tests/backend/message-quality/service.integration.test.ts`             | Excluded, retained unchanged                               | Real PostgreSQL integration, not a unit test.                                         |
| `tests/backend/phone-invite/phone-invite-dismissal.integration.test.ts` | Excluded, retained unchanged                               | Real PostgreSQL integration, not a unit test.                                         |
| `tests/backend/pins/pinned-colleagues.integration.test.ts`              | Excluded, retained unchanged                               | Real PostgreSQL integration, not a unit test.                                         |
| `tests/backend/roles-migration.integration.test.ts`                     | Excluded, retained unchanged                               | Real PostgreSQL integration, not a unit test.                                         |
| `tests/backend/slack/attendance-context.integration.test.ts`            | Excluded, retained unchanged                               | Real PostgreSQL integration, not a unit test.                                         |
| `tests/backend/slack/inbox.integration.test.ts`                         | Excluded, retained unchanged                               | Real PostgreSQL integration, not a unit test.                                         |
| `tests/backend/slack/status-attribution.integration.test.ts`            | Excluded, retained unchanged                               | Real PostgreSQL integration, not a unit test.                                         |
| `tests/backend/status-correction/actions.integration.test.ts`           | Excluded, retained unchanged                               | Real PostgreSQL integration, not a unit test.                                         |
| `tests/e2e.test.ts`                                                     | Excluded, retained unchanged                               | Browser journey across a running app, session and database.                           |
| `tests/navigation.test.ts`                                              | Excluded, retained unchanged                               | Browser journey across a running app, session and database.                           |
| `components/ui/Button/Button.stories.tsx`                               | Excluded from authored unit assertions, retained unchanged | Presentation story without a play/assertion function; browser smoke checks still run. |
| `components/ui/LoginForm/LoginForm.stories.tsx`                         | Excluded from authored unit assertions, retained unchanged | Presentation story without a play/assertion function; browser smoke checks still run. |
| `components/ui/Logo/Logo.stories.tsx`                                   | Excluded from authored unit assertions, retained unchanged | Presentation story without a play/assertion function; browser smoke checks still run. |
| `components/ui/ProfileListItem/ProfileListItem.stories.tsx`             | Excluded from authored unit assertions, retained unchanged | Presentation story without a play/assertion function; browser smoke checks still run. |
| `components/ui/Status/Status.stories.tsx`                               | Excluded from authored unit assertions, retained unchanged | Presentation story without a play/assertion function; browser smoke checks still run. |

## Changes, removals and gaps

The audit replaced false confidence with assertions tied to observable contracts:

- SQL candidate tests now execute the compiled production predicate in PostgreSQL. The
  old helper could pass while the query was broken; all 13 scenarios were transferred.
- Independent emoji expectations catch a wrong mapping instead of agreeing with the same
  exported map. Per-status statistics checks catch category swaps that preserve aggregate totals.
- Partial mocks preserve real workspace predicates and extraction helpers. Session/role
  tests use real server rendering to verify per-render deduplication and next-request revocation.
- Fetch tests restore environment/global state, use real Response objects and distinguish
  an HTTP rejection from body-parsing failure. No unused authentication mock remains.
- Security tests cover actual expiry boundaries, purpose/nonce binding, malformed queue
  payloads, request byte limits, cursor loops and paid-but-invalid model responses.
- Database setup tests distinguish successful commands from a usable schema, verify retry
  limits and cleanup, and use different environment files to detect incorrect file selection.
- Browser Button tests observe callback counts, keyboard activation, loading/disabled
  behavior, submit semantics, accessible labels and destinations. They no longer mutate
  the Storybook root to manufacture a successful assertion.

Eight redundant Slack cases were removed: six conference parser cases already covered
through the real shorthand adapter, a duplicate default-model case covered with stronger
transport assertions, and a city-registry equality case superseded by real alias examples.
No test file was deleted. Weak migration smoke checks, mirrored query logic and misleading
search/model/auth claims were replaced or corrected, with scenario mappings in the ledgers.
No valuable scenario was discarded to obtain a passing suite.

No production bug was confirmed. One unresolved documentation conflict remains:
`docs/slack-setup.md:124` says self-contained replies are processed, while `CONTEXT.md:17`,
the newer setup section and runtime behavior reject all thread replies. Tests follow the
explicit domain rule; this audit did not edit product behavior or that documentation.
Synthetic AI responses cannot establish live-model interpretation quality. Browser
journeys, real Slack/Queue/Gateway communication and deployment checks remain outside scope.

## Complete in-scope file index

Every original in-scope file has exactly one detailed ledger. The new integration file is
listed as a reviewed replacement. Counts are expanded test cases, not quality scores.

| File                                                                   | Disposition                       | Cases | Detailed review                                |
| ---------------------------------------------------------------------- | --------------------------------- | ----: | ---------------------------------------------- |
| `components/ui/Button/Tests/ButtonLinkTest/ButtonLinkTest.stories.tsx` | Improved                          |     4 | [presentation](test-audit-presentation.md)     |
| `components/ui/Button/Tests/ButtonTest/ButtonTest.stories.tsx`         | Improved                          |     5 | [presentation](test-audit-presentation.md)     |
| `tests/backend/admin-status-change/replaced.test.ts`                   | Improved                          |     7 | [presentation](test-audit-presentation.md)     |
| `tests/backend/admin/page.test.ts`                                     | Retained                          |     3 | [presentation](test-audit-presentation.md)     |
| `tests/backend/admin/roles.test.ts`                                    | Improved                          |     9 | [presentation](test-audit-presentation.md)     |
| `tests/backend/ai-cost/daily-views.test.ts`                            | Improved                          |     9 | [presentation](test-audit-presentation.md)     |
| `tests/backend/ai-cost/message-trend.test.ts`                          | Retained                          |    11 | [presentation](test-audit-presentation.md)     |
| `tests/backend/ai-cost/message-views.test.ts`                          | Improved                          |    15 | [presentation](test-audit-presentation.md)     |
| `tests/backend/ai-cost/page-auth.test.ts`                              | Retained                          |     6 | [presentation](test-audit-presentation.md)     |
| `tests/backend/ai-cost/stats.test.ts`                                  | Improved                          |     6 | [presentation](test-audit-presentation.md)     |
| `tests/backend/auth/roles.test.ts`                                     | Improved                          |    10 | [core](test-audit-core.md)                     |
| `tests/backend/className.test.ts`                                      | Improved                          |     3 | [core](test-audit-core.md)                     |
| `tests/backend/database-config.test.ts`                                | Improved                          |    16 | [infrastructure](test-audit-infrastructure.md) |
| `tests/backend/db-migrations/runner.test.ts`                           | Improved                          |    13 | [infrastructure](test-audit-infrastructure.md) |
| `tests/backend/employee-stats/auth.test.ts`                            | Retained                          |     9 | [presentation](test-audit-presentation.md)     |
| `tests/backend/employee-stats/history.test.ts`                         | Improved                          |    19 | [presentation](test-audit-presentation.md)     |
| `tests/backend/employee-stats/navigation.test.ts`                      | Retained                          |     4 | [presentation](test-audit-presentation.md)     |
| `tests/backend/employee-stats/page-auth.test.ts`                       | Improved                          |    32 | [presentation](test-audit-presentation.md)     |
| `tests/backend/employee-stats/sandbox.test.ts`                         | Improved                          |     3 | [presentation](test-audit-presentation.md)     |
| `tests/backend/employee-stats/stats.test.ts`                           | Improved                          |    38 | [presentation](test-audit-presentation.md)     |
| `tests/backend/lib/actions/auth.test.ts`                               | Improved                          |     4 | [core](test-audit-core.md)                     |
| `tests/backend/lib/auth-session.test.ts`                               | Retained                          |    16 | [core](test-audit-core.md)                     |
| `tests/backend/lib/auth/require-user.test.ts`                          | Improved                          |     1 | [core](test-audit-core.md)                     |
| `tests/backend/lib/services/overviewStatusWindow.integration.test.ts`  | Added replacement                 |    13 | [core](test-audit-core.md)                     |
| `tests/backend/lib/services/overviewStatusWindow.test.ts`              | Improved                          |     4 | [core](test-audit-core.md)                     |
| `tests/backend/lib/services/userService.concurrency.test.ts`           | Improved                          |     5 | [core](test-audit-core.md)                     |
| `tests/backend/lib/slack-image.test.ts`                                | Improved                          |    17 | [slack](test-audit-slack.md)                   |
| `tests/backend/lib/slack.test.ts`                                      | Improved                          |    44 | [slack](test-audit-slack.md)                   |
| `tests/backend/lib/slack/text.test.ts`                                 | Improved                          |     6 | [slack](test-audit-slack.md)                   |
| `tests/backend/lib/status/active.test.ts`                              | Improved                          |     6 | [core](test-audit-core.md)                     |
| `tests/backend/lib/status/correction.test.ts`                          | Improved                          |     6 | [core](test-audit-core.md)                     |
| `tests/backend/lib/status/emoji.test.ts`                               | Improved                          |     5 | [core](test-audit-core.md)                     |
| `tests/backend/lib/status/plan.test.ts`                                | Retained                          |     7 | [core](test-audit-core.md)                     |
| `tests/backend/lib/status/presence.test.ts`                            | Retained                          |    16 | [core](test-audit-core.md)                     |
| `tests/backend/lib/status/week.test.ts`                                | Retained                          |    24 | [core](test-audit-core.md)                     |
| `tests/backend/local-database.test.ts`                                 | Improved                          |    21 | [infrastructure](test-audit-infrastructure.md) |
| `tests/backend/message-quality/auth.test.ts`                           | Improved                          |     5 | [presentation](test-audit-presentation.md)     |
| `tests/backend/message-quality/navigation.test.ts`                     | Retained                          |     2 | [presentation](test-audit-presentation.md)     |
| `tests/backend/message-quality/page-auth.test.ts`                      | Retained                          |     3 | [presentation](test-audit-presentation.md)     |
| `tests/backend/message-quality/stats.test.ts`                          | Retained                          |     4 | [presentation](test-audit-presentation.md)     |
| `tests/backend/pwa/look-around.test.ts`                                | Improved                          |     4 | [core](test-audit-core.md)                     |
| `tests/backend/pwa/middleware.test.ts`                                 | Retained                          |     4 | [core](test-audit-core.md)                     |
| `tests/backend/pwa/service-worker.test.ts`                             | Improved                          |    12 | [core](test-audit-core.md)                     |
| `tests/backend/sandbox/auth.test.ts`                                   | Improved                          |     8 | [core](test-audit-core.md)                     |
| `tests/backend/sandbox/enabled.test.ts`                                | Retained                          |     4 | [core](test-audit-core.md)                     |
| `tests/backend/sandbox/envelope.test.ts`                               | Improved                          |     7 | [core](test-audit-core.md)                     |
| `tests/backend/sandbox/middleware.test.ts`                             | Retained                          |     3 | [core](test-audit-core.md)                     |
| `tests/backend/sandbox/reset.test.ts`                                  | Improved                          |     5 | [core](test-audit-core.md)                     |
| `tests/backend/sandbox/service.test.ts`                                | Retained                          |    12 | [core](test-audit-core.md)                     |
| `tests/backend/slack/ai-usage-response.test.ts`                        | Improved                          |    23 | [slack](test-audit-slack.md)                   |
| `tests/backend/slack/ai-usage.test.ts`                                 | Improved                          |     6 | [slack](test-audit-slack.md)                   |
| `tests/backend/slack/comments-display.test.ts`                         | Improved                          |    17 | [slack](test-audit-slack.md)                   |
| `tests/backend/slack/context-extraction.test.ts`                       | Improved                          |     8 | [slack](test-audit-slack.md)                   |
| `tests/backend/slack/events.test.ts`                                   | Improved                          |    31 | [slack](test-audit-slack.md)                   |
| `tests/backend/slack/extraction.test.ts`                               | Improved; duplicate cases removed |    36 | [slack](test-audit-slack.md)                   |
| `tests/backend/slack/installation.test.ts`                             | Improved                          |    37 | [slack](test-audit-slack.md)                   |
| `tests/backend/slack/learned-shorthand.test.ts`                        | Improved                          |    31 | [slack](test-audit-slack.md)                   |
| `tests/backend/slack/queue.test.ts`                                    | Improved                          |    17 | [slack](test-audit-slack.md)                   |
| `tests/backend/slack/review-deletion.test.ts`                          | Improved                          |     1 | [slack](test-audit-slack.md)                   |
| `tests/backend/slack/review-extraction.test.ts`                        | Improved; duplicate cases removed |    24 | [slack](test-audit-slack.md)                   |
| `tests/backend/slack/review-routes.test.ts`                            | Improved                          |    32 | [slack](test-audit-slack.md)                   |
| `tests/backend/slack/shorthand.test.ts`                                | Improved; duplicate cases removed |    96 | [slack](test-audit-slack.md)                   |
| `tests/backend/slack/week-cache-invalidation.test.ts`                  | Improved                          |     9 | [slack](test-audit-slack.md)                   |
| `tests/backend/test-database-setup.test.ts`                            | Improved                          |     9 | [infrastructure](test-audit-infrastructure.md) |
| `tests/backend/theme/themes.test.ts`                                   | Improved                          |    50 | [presentation](test-audit-presentation.md)     |
| `tests/backend/userHelper.test.ts`                                     | Improved                          |    11 | [core](test-audit-core.md)                     |
| `tests/backend/utils/fetchers.test.ts`                                 | Improved                          |     8 | [core](test-audit-core.md)                     |
| `tests/backend/utils/format-date.test.ts`                              | Retained                          |     3 | [core](test-audit-core.md)                     |
| `tests/backend/week/ai-indicator.test.ts`                              | Retained                          |     7 | [presentation](test-audit-presentation.md)     |
| `tests/backend/week/attendance-grouping.test.ts`                       | Retained                          |    13 | [presentation](test-audit-presentation.md)     |
| `tests/backend/week/cache-tag.test.ts`                                 | Retained                          |     3 | [presentation](test-audit-presentation.md)     |
| `tests/backend/week/colleague-status.test.ts`                          | Improved                          |     9 | [presentation](test-audit-presentation.md)     |
| `tests/backend/week/date-navigation.test.ts`                           | Retained                          |    11 | [presentation](test-audit-presentation.md)     |
| `tests/backend/week/new-since-last-look.test.ts`                       | Improved                          |     8 | [presentation](test-audit-presentation.md)     |
| `tests/backend/week/side-panel-toggle.test.ts`                         | Improved                          |     9 | [presentation](test-audit-presentation.md)     |
| `tests/backend/week/status-cache-invalidation.test.ts`                 | Improved                          |    14 | [presentation](test-audit-presentation.md)     |
| `tests/backend/week/today-page.test.ts`                                | Improved                          |    23 | [presentation](test-audit-presentation.md)     |
| `tests/backend/week/today-refresh.test.ts`                             | Retained                          |     6 | [presentation](test-audit-presentation.md)     |
| `tests/backend/week/week-cache.test.ts`                                | Improved                          |     2 | [presentation](test-audit-presentation.md)     |
| `tests/backend/week/week-overview-rendering.test.ts`                   | Retained                          |    57 | [presentation](test-audit-presentation.md)     |
| `tests/backend/week/week-overview.test.ts`                             | Retained                          |     3 | [presentation](test-audit-presentation.md)     |
| `tests/backend/week/week-view.test.ts`                                 | Retained                          |     4 | [presentation](test-audit-presentation.md)     |

## Final verification and remaining limits

- Complete backend run after the last fixture edits: **1,234 passed, 0 failed, 0 skipped,
  97 files**. This includes 1,086 unit cases and 148 PostgreSQL cases, including the 13
  new real-query replacements. All 17 original database files were executed despite
  their exclusion from the unit-quality audit.
- CI Storybook build: passed. Standalone Chromium test-runner: **29 passed in 7 files**,
  including all nine authored cases in both audited story files. Axe reported no violations.
- `pnpm lint`, `pnpm typecheck`, explicit ESLint on all changed test files, Prettier checks
  on changed code, and `git diff --check`: passed.
- **18 targeted defects were detected**: four core runtime transforms, six Slack transforms,
  five dashboard/access transforms, two infrastructure transforms, and one browser-served
  Button callback removal. The Button fault failed exactly its activation assertion while
  the other 28 stories passed. Infrastructure faults likewise failed the expected SQL or
  incomplete-schema assertion. Production files were never mutated on disk.
- A file-index check matched all 79 original backend unit files and both authored story
  files to exactly one detailed ledger. Of those original files, 25 were retained and 56
  improved. One additional integration file contains transferred scenarios. No original
  file was deleted. Counts document scope; the case rationales and detected defects explain
  the value of the changes.
- Optional Vitest Storybook integration: still blocked by the pre-existing incompatible
  framework setup described above. It is not counted as a passing validation command.
  Every authored story was instead validated through the repository's existing CI runner.
- No in-scope unit case remains unreviewed or unexecuted. The E2E journeys, live external
  services, production build/deployment, and audit of existing database-integration test
  quality remain excluded. The thread-reply documentation conflict remains unresolved.

Raw baseline/final JSON, command logs and isolated mutation reports were written to
`/tmp/work-test-audit/` during this run. They contain synthetic fixtures and are temporary;
this checked-in ledger records the conclusions and all reviewed files/cases. Chromium
was installed in that temporary folder. The installer stalled extracting with Node 26;
using the already-installed Node 22 runtime completed installation. No dependency or
lockfile changes were needed. The disposable PostgreSQL container, temporary HTTP test
servers and generated Storybook build were removed after validation.
