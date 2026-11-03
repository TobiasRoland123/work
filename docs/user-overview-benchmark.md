# User overview benchmark

`scripts/benchmark-user-overview.ts` runs the real `userService.getAllUsers(false, days)` through Drizzle and a disposable local PostgreSQL 16 container. It compares the baseline service from Git with the current working tree, using the same database and fixed application clock.

Run from the repository root with Node, installed dependencies and Docker available:

```sh
pnpm exec tsx scripts/benchmark-user-overview.ts
# Optional baseline revision:
pnpm exec tsx scripts/benchmark-user-overview.ts 1ab6be6a2b76f9347b33c9c8bd29987ee259e132
```

The default baseline is `1ab6be6a2b76f9347b33c9c8bd29987ee259e132`, before the overview query optimization. The script creates its own container with a random localhost port and removes it afterward. It supplies its own connection settings and leaves existing databases untouched. It writes raw samples, output hashes and query row counts to `.local/user-overview-benchmark.json`.

The fixture has 100 active users, 365 status rows per active user, one inactive user, organisation roles and phone numbers. Most rows are historical declarations. Today's rows also cover expired and future exact clocks, approximate clocks, legacy declarations without date bounds, open date ranges, a timed arrival and a user receiving the default office status. For example, an expired declaration still suppresses today's synthetic office default, even though its clock interval has ended.

Before timing, the script checks deep equality of every returned field for today, the five-day week, a historical day, a future day and a call without requested days. Both versions use `2026-11-04T11:00:00Z` as application time with the host timezone set to UTC. The resolvers still apply Copenhagen calendar rules.

Each measured view gets three warmups and 20 measurements per version. The script alternates which version runs first. Timings include PostgreSQL queries, result transfer, Drizzle mapping and service resolution. The median averages the two middle samples; p95 uses the nearest-rank method. Status row counts come from PostgreSQL query results, rather than estimates from the fixture.

Measured on 2026-11-04 local time with Node v26.12.0 and PostgreSQL 16.15:

| View          | Before median | After median |  Before p95 | After p95 | Median speedup | Status rows before | Status rows after |
| ------------- | ------------: | -----------: | ----------: | --------: | -------------: | -----------------: | ----------------: |
| Today         |     333.59 ms |      9.08 ms |   340.14 ms |  10.73 ms |         36.74x |             36,500 |                99 |
| Five-day week |   1,285.64 ms |     23.67 ms | 1,309.30 ms |  25.65 ms |         54.33x |             36,500 |               299 |

All equality checks passed. Each version issued five database queries per call. The optimized path fetched fewer status rows and reused today's resolved week cell.

These numbers describe a warm local service call with synthetic history. They exclude HTTP rendering, authentication, production network latency and Next.js cache hits. The fixture uses the overview tables with their primary keys and no added status index. Results on production data, different hardware or a different history distribution will vary. Existing callers can rerun the script to compare their checked-out implementation with the same baseline.
