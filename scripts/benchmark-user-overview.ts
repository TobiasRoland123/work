/** Isolated PostgreSQL benchmark. See docs/user-overview-benchmark.md. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const baselineRef = process.argv[2] ?? '1ab6be6a2b76f9347b33c9c8bd29987ee259e132';
const baselinePath = path.join(root, '.local', `benchmark-baseline-${process.pid}.ts`);
const container = `work-overview-benchmark-${process.pid}`;
const fixedNow = '2026-11-04T11:00:00.000Z';
const today = fixedNow.slice(0, 10);
const week = ['2026-11-02', '2026-11-03', today, '2026-11-05', '2026-11-06'];
const warmups = 3;
const measurements = 20;
let createdContainer = false;
let closePool: (() => Promise<void>) | undefined;
const RealDate = Date;

function docker(...args: string[]) {
  return execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function summarize(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    medianMs: (sorted[9] + sorted[10]) / 2,
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
    samplesMs: samples,
  };
}

async function main() {
  await mkdir(path.join(root, '.local'), { recursive: true });
  const baseline = execFileSync('git', ['show', `${baselineRef}:lib/services/userService.ts`], {
    encoding: 'utf8',
  });
  // The original service stays intact; only relative module locations change in this temp copy.
  await writeFile(
    baselinePath,
    baseline.replace(
      /from '([.][^']+)'/g,
      (_, modulePath: string) => `from '${path.join(root, 'lib/services', modulePath)}'`
    )
  );
  docker(
    'run',
    '-d',
    '--rm',
    '--name',
    container,
    '-e',
    'POSTGRES_HOST_AUTH_METHOD=trust',
    '-e',
    'POSTGRES_DB=overview_benchmark',
    '-p',
    '127.0.0.1::5432',
    'postgres:16-alpine'
  );
  createdContainer = true;
  for (let attempt = 0; ; attempt++) {
    try {
      docker('exec', container, 'pg_isready', '-U', 'postgres');
      break;
    } catch (error) {
      if (attempt >= 60) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  const port = docker('port', container, '5432/tcp').split(':').at(-1)!;
  Object.assign(process.env, {
    NODE_ENV: 'test',
    PGHOST: '127.0.0.1',
    PGPORT: port,
    PGUSER: 'postgres',
    PGPASSWORD: '',
    PGDATABASE: 'overview_benchmark',
    TZ: 'UTC',
  });
  const { pool } = await import('../db');
  closePool = () => pool.end();
  await pool.query(`
    CREATE TYPE system_role AS ENUM ('ADMIN', 'MANAGER', 'EMPLOYEE');
    CREATE TYPE user_status AS ENUM ('IN_OFFICE','FROM_HOME','AT_CLIENT','SICK','IN_LATE',
      'LEAVING_EARLY','VACATION','CHILD_SICK','ON_LEAVE','AWAY','REMOTE');
    CREATE TABLE organisations (id serial PRIMARY KEY, organisation_name varchar(255));
    CREATE TABLE users (
      id serial, user_id varchar(36) PRIMARY KEY, first_name varchar(60), last_name varchar(255),
      email varchar(100) NOT NULL, system_role system_role NOT NULL DEFAULT 'EMPLOYEE',
      can_review_messages boolean NOT NULL DEFAULT false, created_at timestamp NOT NULL,
      organisation_id integer REFERENCES organisations(id), mobile_phone varchar(20),
      profile_picture text, slack_user_id varchar(32), slack_team_id varchar(32),
      slack_deactivated boolean NOT NULL DEFAULT false);
    CREATE TABLE organisation_roles (id serial PRIMARY KEY, role_name varchar(255));
    CREATE TABLE users_organisation_roles (id serial PRIMARY KEY, user_id varchar(36), organisation_role_id integer);
    CREATE TABLE business_phone_numbers (id serial PRIMARY KEY, business_phone_numbers varchar(20));
    CREATE TABLE users_business_phone_numbers (id serial PRIMARY KEY, user_id varchar(36), business_phone_numbers_id integer);
    CREATE TABLE status (
      id serial PRIMARY KEY, user_id varchar(36) REFERENCES users(user_id), status user_status,
      details text, emoji text, time timestamp, from_date date, to_date date, source_message_key text,
      starts_at timestamptz, ends_at timestamptz, starts_at_approximate boolean NOT NULL DEFAULT false,
      ends_at_approximate boolean NOT NULL DEFAULT false, announced_at timestamptz, created_at timestamp NOT NULL);
    INSERT INTO organisations VALUES (1, 'Benchmark organisation');
    INSERT INTO organisation_roles VALUES (1, 'Engineer'), (2, 'Project lead');
    INSERT INTO business_phone_numbers VALUES (1, '+45 12345678');
    INSERT INTO users (user_id, first_name, last_name, email, created_at, organisation_id, slack_deactivated)
      SELECT 'benchmark-' || n, 'User ' || lpad(n::text, 3, '0'), 'Fixture',
        'user-' || n || '@example.invalid', '2025-01-01', 1, n = 101
      FROM generate_series(1, 101) n;
    INSERT INTO users_organisation_roles (user_id, organisation_role_id)
      SELECT user_id, 1 FROM users;
    INSERT INTO users_business_phone_numbers (user_id, business_phone_numbers_id)
      SELECT user_id, 1 FROM users;
    INSERT INTO status (user_id, status, details, from_date, to_date, announced_at, created_at)
      SELECT 'benchmark-' || n, (CASE WHEN d % 7 = 0 THEN 'FROM_HOME' ELSE 'IN_OFFICE' END)::user_status,
        repeat('Deterministic synthetic history. ', 4),
        '2026-11-04'::date - d, '2026-11-04'::date - d,
        ('2026-11-04'::date - d + time '07:00') AT TIME ZONE 'Europe/Copenhagen',
        '2026-11-04'::date - d + time '07:00'
      FROM generate_series(1, 100) n CROSS JOIN generate_series(0, 364) d;
    -- Reuse today's row to cover defaults, expired/planned clocks, legacy dates and open bounds.
    UPDATE status SET from_date = '2025-01-01', to_date = '2025-01-01'
      WHERE user_id = 'benchmark-1' AND from_date = '2026-11-04';
    UPDATE status SET starts_at = '2026-11-04T06:00Z', ends_at = '2026-11-04T07:00Z'
      WHERE user_id = 'benchmark-2' AND from_date = '2026-11-04';
    UPDATE status SET starts_at = '2026-11-04T14:00Z', ends_at = '2026-11-04T16:00Z'
      WHERE user_id = 'benchmark-3' AND from_date = '2026-11-04';
    UPDATE status SET from_date = NULL, to_date = NULL
      WHERE user_id = 'benchmark-4' AND from_date = '2026-11-04';
    UPDATE status SET from_date = '2026-10-28', to_date = NULL
      WHERE user_id = 'benchmark-5' AND from_date = '2026-11-04';
    UPDATE status SET from_date = NULL, to_date = '2026-11-11'
      WHERE user_id = 'benchmark-6' AND from_date = '2026-11-04';
    UPDATE status SET from_date = NULL, to_date = NULL,
      starts_at = '2026-11-04T06:00Z', ends_at = '2026-11-04T14:00Z'
      WHERE user_id = 'benchmark-7' AND from_date = '2026-11-04';
    UPDATE status SET starts_at = '2026-11-04T14:00Z', starts_at_approximate = true
      WHERE user_id = 'benchmark-8' AND from_date = '2026-11-04';
    UPDATE status SET status = 'IN_OFFICE', time = '2026-11-04T13:00:00'
      WHERE user_id = 'benchmark-9' AND from_date = '2026-11-04';
    UPDATE status SET announced_at = NULL, from_date = NULL, to_date = NULL
      WHERE user_id = 'benchmark-10' AND from_date = '2026-11-04';
    ANALYZE;
  `);
  const fixtureCounts = (
    await pool.query(`SELECT (SELECT count(*)::int FROM users) AS users,
    (SELECT count(*)::int FROM status) AS statuses`)
  ).rows[0];

  // A fixed application clock leaves performance.now() and PostgreSQL query timings live.
  globalThis.Date = new Proxy(RealDate, {
    construct(target, args) {
      return Reflect.construct(target, args.length ? args : [fixedNow]);
    },
    get(target, property) {
      return property === 'now' ? () => RealDate.parse(fixedNow) : Reflect.get(target, property);
    },
  });
  const [{ userService: before }, { userService: after }] = await Promise.all([
    import(pathToFileURL(baselinePath).href),
    import('../lib/services/userService'),
  ]);

  type QueryResult = { rows: unknown[]; rowCount: number | null };
  const originalQuery = pool.query.bind(pool) as (...args: unknown[]) => Promise<QueryResult>;
  let rowCounts: number[] = [];
  let queryCount = 0;
  pool.query = ((...args: unknown[]) => {
    const statement = args[0] as string | { text: string };
    const sql = typeof statement === 'string' ? statement : statement.text;
    queryCount++;
    return originalQuery(...args).then((result) => {
      if (/from "status"/i.test(sql)) rowCounts.push(result.rowCount ?? result.rows.length);
      return result;
    });
  }) as typeof pool.query;

  const equivalenceViews: Array<readonly string[] | undefined> = [
    [today],
    week,
    ['2026-10-28'],
    ['2026-11-05'],
    undefined,
  ];
  const equivalence = [];
  for (const days of equivalenceViews) {
    const expected = await before.getAllUsers(false, days);
    const actual = await after.getAllUsers(false, days);
    assert.deepStrictEqual(actual, expected, `Full output differs for ${JSON.stringify(days)}`);
    equivalence.push({
      days: days ?? null,
      users: actual.length,
      outputSha256: createHash('sha256').update(JSON.stringify(actual)).digest('hex'),
    });
  }
  console.info('Full output equality passed: today, week, historical, future and no-days calls.');

  const scenarios = [];
  for (const [name, days] of [
    ['today', [today]],
    ['week', week],
  ] as const) {
    const samples = { before: [] as number[], after: [] as number[] };
    const counts = { before: [] as number[], after: [] as number[] };
    const queries = { before: [] as number[], after: [] as number[] };
    for (let iteration = -warmups; iteration < measurements; iteration++) {
      // Alternate first runner to reduce systematic warm-cache / scheduler bias.
      const variants =
        iteration % 2 ? (['after', 'before'] as const) : (['before', 'after'] as const);
      for (const variant of variants) {
        rowCounts = [];
        queryCount = 0;
        const start = performance.now();
        const result = await { before, after }[variant].getAllUsers(false, days);
        const elapsed = performance.now() - start;
        assert.equal(result.length, 100);
        assert.equal(rowCounts.length, 1, 'Expected one status query per call');
        if (iteration >= 0) {
          samples[variant].push(elapsed);
          counts[variant].push(rowCounts[0]);
          queries[variant].push(queryCount);
        }
      }
      if (iteration >= 0 && (iteration + 1) % 5 === 0)
        console.info(`${name}: ${iteration + 1}/${measurements} measured pairs complete`);
    }
    scenarios.push({
      name,
      days,
      before: {
        ...summarize(samples.before),
        statusRowsPerCall: counts.before,
        queriesPerCall: queries.before,
      },
      after: {
        ...summarize(samples.after),
        statusRowsPerCall: counts.after,
        queriesPerCall: queries.after,
      },
      medianSpeedup: summarize(samples.before).medianMs / summarize(samples.after).medianMs,
    });
  }
  const optimizedSource = await readFile(path.join(root, 'lib/services/userService.ts'), 'utf8');
  const results = {
    generatedAt: new RealDate().toISOString(),
    baselineRef,
    optimizedSourceSha256: createHash('sha256').update(optimizedSource).digest('hex'),
    node: process.version,
    postgres: docker('exec', container, 'postgres', '--version'),
    fixedNow,
    timezone: 'UTC',
    fixture: { ...fixtureCounts, activeUsers: 100, historyDaysPerUser: 365 },
    warmupsPerVariantPerScenario: warmups,
    measurementsPerVariantPerScenario: measurements,
    equivalence,
    scenarios,
    scope:
      'Actual service + Drizzle + isolated local PostgreSQL, warm process. No HTTP/auth/Next cache/network to production.',
  };
  const output = path.join(root, '.local/user-overview-benchmark.json');
  await writeFile(output, JSON.stringify(results, null, 2) + '\n');
  console.info(
    JSON.stringify(
      {
        output,
        scenarios: scenarios.map(({ name, before, after, medianSpeedup }) => ({
          name,
          beforeMedianMs: before.medianMs,
          beforeP95Ms: before.p95Ms,
          afterMedianMs: after.medianMs,
          afterP95Ms: after.p95Ms,
          medianSpeedup,
          beforeStatusRows: before.statusRowsPerCall[0],
          afterStatusRows: after.statusRowsPerCall[0],
        })),
      },
      null,
      2
    )
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    globalThis.Date = RealDate;
    await closePool?.();
    if (createdContainer) docker('rm', '-f', container);
    await rm(baselinePath, { force: true });
  });
