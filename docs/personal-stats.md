# Personal attendance dashboard

The personal dashboard at `/my-stats` shows the signed-in person's attendance trend over 7, 30, 90, 180 or 365 calendar days, ending today in Europe/Copenhagen. Open **My stats** in the desktop navigation or the mobile **More** menu. The default is 30 days. It optionally compares their recorded office share with the company average. It uses existing declarations and requires no database migration or historical import branch.

## Access and data boundary

`getPersonalStats` authenticates through `requireUserId` and checks `getUserRole` at the read boundary. An active, Slack-mapped employee, manager or admin in the configured `SLACK_TEAM_ID` workspace can use it. Missing authentication returns the normal not-found response. An account without an active mapped role goes to `/permission-denied`.

The service has no target-user parameter. Passing a `userId` field cannot change the subject. Manager employee-statistics services and their permissions remain separate.

Comparison defaults to on. Public page parameters are `range` and `comparison`; the page maps these to the service's `days` and `compare` fields. `compare: 'off'` disables comparison. When disabled, the member lookup and both declaration queries include only the signed-in user. Colleagues are neither loaded nor calculated.

When enabled, the comparison population is the other currently active Slack-mapped employees in the configured workspace. It excludes the subject. The database lookup selects only internal user IDs and account creation timestamps, and the returned dashboard contains no employee IDs, names, emails, rankings, percentiles, colleague rows or colleague absence breakdowns. The company response contains only its allowed office share and suppression reason.

## What a day means

Only weekdays that have reached 09:00 Copenhagen time count. Today is included after 09:00 and resolves at the current instant. Past weekdays resolve at 09:00 Copenhagen using the shared `resolvePresenceStatus` rules. The dashboard therefore describes recorded declarations at those points, rather than measured hours or verified physical attendance. Weekends are excluded. There is no holiday calendar or contract-specific workweek in this calculation.

A person is eligible from their account's creation day or earliest visible actual attendance declaration, whichever is earlier. A declaration before account creation can therefore extend tracking backward. A future join date does not create eligible days. Both sides use the subject's eligible weekdays, and each colleague is additionally excluded before their own tracking begins.

Declarations classify into these personal categories:

| Category        | Statuses                                                             |
| --------------- | -------------------------------------------------------------------- |
| Office          | `IN_OFFICE`, `IN_LATE`, `LEAVING_EARLY`                              |
| Home and remote | `FROM_HOME`, `REMOTE`                                                |
| Client          | `AT_CLIENT`                                                          |
| Away            | `SICK`, `CHILD_SICK`, `VACATION`, `ON_LEAVE`, `AWAY`                 |
| Unknown         | No applicable classified declaration, including an unclassified note |
| Assumed         | The resolver's synthetic Workday Default with ID zero                |

Synthetic defaults never count as recorded office attendance. Unknown and assumed are distinct, mutually exclusive counts. Days before tracking are excluded entirely. Superseded declarations are excluded from both the earliest-declaration query and attendance query.

For example, one recorded office day, one recorded remote day and three assumed office defaults produce an office share of 50% and recorded coverage of 40%. They do not produce four recorded office days.

## Ratios and missing history

Personal office share is recorded office days divided by recorded working days. Working days include office, home/remote and client, and exclude away, unknown and assumed days. It is `null` when there are no recorded working days.

Recorded coverage is classified days divided by eligible weekdays. Classified days include office, home/remote, client and away. A zero denominator produces `null`, while eligible days without classified declarations produce zero coverage.

Coverage does not measure Slack import completion. The current schema has no per-month import completion proof, and this dashboard cannot distinguish a missing announcement from history that has not been imported. It always reports `historyCompleteness: 'unverified'`. Company comparisons are always provisional, including when recorded coverage is 100%. The page must disclose this limitation.

## Day breakdown and weekday pattern

Below the trend, **Where your days went** shows the whole selected period as a proportional bar and exact counts for office, home/remote, client, away, unknown status and assumed office. These categories add up to the eligible weekdays. Unknown and assumed days remain separate and never increase recorded office attendance; the page does not claim they prove missing Slack history.

**Your weekday pattern** pools all Mondays, Tuesdays and so on within the selected period. Each weekday uses recorded office days divided by recorded working days, rather than an average of weekly percentages. The company bar pools the other active employees over those same dates and applies the comparison thresholds independently to each weekday. Days before an employee joined remain excluded. Zero percent is a real value; N/A means there were no recorded working days. A hidden company value has a disclosure explaining the reason. Turning comparison off removes company bars and values here as well as in the trend.

The cards sit side by side on desktop and stack on narrow screens. Text labels and counts accompany the colors, and both personal and company percentages are available without hovering.

## Company average policy

The company average pools recorded office days and divides by pooled recorded working days for the other active employees. It is weighted by working days, so someone with one recorded working day does not count as much as someone with twenty. It includes no absence or status-specific company breakdown.

The whole period, every chart bucket and each weekday independently require:

- At least four other employees contributing recorded working days in that period or bucket.
- At least 80% recorded coverage for the subject and at least 80% pooled recorded coverage for eligible colleagues.
- At least one recorded working day for the subject and company.

Suppression reasons are `off`, `small-cohort`, `low-coverage` and `no-working-days`, evaluated in that order. A permitted comparison has a `null` reason. A suppressed comparison always has a `null` share. The service never substitutes a zero or an invented average. Four colleagues with recorded office days and one subject with only away days yield no comparison because the subject has no recorded working days.

Company coverage includes all eligible colleague days, including missing declarations from employees who do not contribute recorded working days. This prevents a small well-recorded subset from hiding sparse company coverage. The minimum contributor rule also prevents publishing a comparison made entirely from colleagues' absence declarations.

Buckets reuse `bucketWorkdays`, which selects daily points for short periods and weekly points for the offered longer periods. Both series use identical bucket boundaries. The response includes personal totals and their denominators for each bucket, plus only an allowed aggregate company share or its suppression reason. There are no sensitive cohort filters.

## Queries and verification

The service first reads the authenticated population and the earliest visible real attendance declaration for each selected account. Attendance rows must overlap the selected workdays. Inclusive date intervals, clock-only intervals and undated announcements are handled separately. A one-day margin retains declarations at date boundaries. Instants use Copenhagen midnight boundaries through daylight saving changes. The earliest-declaration aggregate reads history only to establish tracking; the attendance query is bounded by the chosen period.

Focused checks run without a database:

```sh
pnpm exec vitest run --project backend tests/backend/personal-stats.test.ts tests/backend/personal-stats-service.test.ts
```

The pure tests cover category mapping, synthetic defaults, unknown and prejoin days, timing and daylight saving boundaries, ratio denominators, exact coverage thresholds, minimum contributors, per-bucket and per-weekday suppression, calendar weekday grouping and pooled averages. Mocked service tests exercise authentication, all allowed roles, workspace membership predicates, self-only queries when comparison is disabled, ignored target IDs, declaration visibility, bounded date and clock queries, earlier declarations, future join dates and aggregate-only output. They inspect generated Drizzle SQL and parameters without connecting to a database.
