# Verification of this migration

Verified locally on 8 September 2026:

- TypeScript check and ESLint on changed integration/auth/UI/test files pass.
- Production `pnpm build` passes. The existing Supabase realtime dependency emits a dynamic-dependency warning; Node also emits a deprecation warning. Neither blocks the build.
- All 99 backend tests pass against a disposable PostgreSQL 17 cluster. Slack and AI HTTP responses in these tests are synthetic/mocked. Coverage includes signature validation, payload limits, durable acknowledgment, cron authorization, identity conflicts/races, deactivation, original-message date anchoring, approximation flags, DST, date expiry, mixed manual/imported timestamp precedence, duplicates, unclear/ignored edits, explicit deletion without a previous-message body, and deletion during processing.
- Applied migrations 0034, 0035 and 0036 to a separate copy of the preceding schema with a synthetic legacy user/status. Their ID and history survived; no target/production database was changed.
- Browser checked login, Today and Profile with a synthetic locally signed Slack session. Login shows the Slack button, and the authenticated pages render with the test user. The approximate arrival renders as ca. 10.00 with its source link. The same session received HTTP 200 from /api/me while active and HTTP 401 after its activity flag was disabled; the protected page then displayed login. This bypasses OAuth intentionally and does not prove a live Slack sign-in.

The test command was `pnpm exec vitest run --project backend`, with local `PG*` variables targeting the disposable `work_slack_test` database and `SLACK_TEST_DATABASE=1` enabling the new opt-in database tests. The legacy image-upload test also needs synthetic `HETZNER_BUCKET_URL` and `HETZNER_BUCKET_NAME` values; its storage calls are mocked. Never point the existing database test suite at production.

Not verified live: WORK 2.0 installation/permissions, redirect and Events API reachability, real workspace membership/photo retrieval, the configured model's Danish/English interpretation accuracy, scheduler deployment and production database cutover. These require actual credentials and administrator setup. No Slack status writes, Slack messages, installations, approval requests or deployments were performed.


The delivery coordinator independently copied and hash-checked the frozen implementation into `/Users/Z6SEU/.codex/worktrees/dd03/work` on branch `feature/slack-migration-reviewed`. In that checkout, all 99 backend tests, full `pnpm lint`, and `pnpm build` including TypeScript checking passed. A second disposable PostgreSQL 17 instance received migrations 0034–0036 over the previous schema. Assertions confirmed preservation of the synthetic legacy user ID, email, ADMIN role, profile image, attendance history, organisation-role link and business-phone link. Both source worktrees were preserved. The independent checks used synthetic data and no production credentials.

## Comment extraction and AI SDK follow-up

The follow-up now separates each attendance interval from the sender's stated comment using AI interpretation. It uses `ai` 7.0.93 and `@ai-sdk/openai` 4.0.60, with Zod 3.25.76 for validated structured output. The existing status `details` field stores the source excerpt; no additional database migration is required. Imported time display reads interval bounds independently of comment wording.

All 111 backend tests, full `pnpm lint`, and production `pnpm build` including TypeScript checking pass. The existing Supabase dependency and Node deprecation warnings remain nonblocking. The added checks cover English and Danish explanations before or after the attendance phrase, rejection of invented/empty/oversized comments, missing model configuration, escaped UI output, unspecified and approximate clock display, and database persistence through valid edits, unclear edits and deletion. Adapter tests exercise the actual AI SDK and OpenAI provider with mocked HTTP responses. PostgreSQL tests use the disposable local database. These tests verify integration behavior, not a live model's interpretation accuracy.

`.env.example` contains the user-requested `gpt-5.6-luna` placeholder. Its OpenAI API availability has not been verified. No actual extraction model was configured, and the application has no fallback model. No live AI calls, Slack changes or deployment were performed for this follow-up. No subagents were used for this follow-up.
