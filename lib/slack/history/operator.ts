import type { Pool } from 'pg';

export type ImportTarget = { connectionString: string; identity: string };

/** Deliberately does not read .env, PG*, DATABASE_URL, or the app's default pool. */
export function explicitImportTarget(env: Record<string, string | undefined>): ImportTarget {
  const raw = env.SLACK_IMPORT_DATABASE_URL;
  if (!raw)
    throw new Error(
      'Set SLACK_IMPORT_DATABASE_URL explicitly; app database defaults are never used.'
    );
  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol))
    throw new Error('Expected a PostgreSQL target URL.');
  const host = env.SLACK_IMPORT_EXPECT_HOST;
  const database = env.SLACK_IMPORT_EXPECT_DATABASE;
  const user = env.SLACK_IMPORT_EXPECT_USER;
  if (!host || !database || !user)
    throw new Error(
      'Set SLACK_IMPORT_EXPECT_HOST, SLACK_IMPORT_EXPECT_DATABASE and SLACK_IMPORT_EXPECT_USER from the independently verified target.'
    );
  if (
    url.hostname !== host ||
    decodeURIComponent(url.pathname.slice(1)) !== database ||
    decodeURIComponent(url.username) !== user
  )
    throw new Error(
      'Import connection does not match the independently specified host/database/user.'
    );
  if (
    url.searchParams.has('host') ||
    url.searchParams.has('user') ||
    url.searchParams.has('dbname')
  )
    throw new Error('Connection URL query parameters cannot override target identity.');
  return { connectionString: raw, identity: `${host}/${database}/${user}` };
}

export async function inspectImportDatabase(
  pool: Pool,
  expectedDatabase: string,
  adminUserId: string
) {
  const identity = (
    await pool.query<{ database: string; role: string; server: string | null }>(
      'select current_database() as database, current_user as role, inet_server_addr()::text as server'
    )
  ).rows[0];
  if (identity.database !== expectedDatabase)
    throw new Error('Connected server reports an unexpected database.');
  const { rows } = await pool.query<{ system_role: string; slack_deactivated: boolean }>(
    'select system_role, slack_deactivated from users where user_id = $1',
    [adminUserId]
  );
  if (rows.length !== 1 || rows[0].system_role !== 'ADMIN' || rows[0].slack_deactivated)
    throw new Error('The operator must identify an active ADMIN in this target database.');
  const ledger = await pool.query(
    'select hash, created_at from drizzle.__drizzle_migrations order by created_at desc limit 1'
  );
  if (!ledger.rowCount) throw new Error('The target has no recorded Drizzle migration baseline.');
  const tables = [
    'users',
    'status',
    'status_supersessions',
    'status_corrections',
    'slack_messages',
    'slack_import_runs',
    'slack_import_items',
  ];
  const schema = await pool.query<{ name: string; present: string | null }>(
    "select name, to_regclass('public.' || name)::text as present from unnest($1::text[]) name",
    [tables]
  );
  const missing = schema.rows.filter((row) => !row.present).map((row) => row.name);
  if (missing.length) throw new Error(`Target schema is missing: ${missing.join(', ')}`);
  return { identity, migration: ledger.rows[0], tables: schema.rows };
}

/** These attestations record operator checks; they cannot inspect other deployments. */
export function assertImportIsolation(
  env: Record<string, string | undefined>,
  mode: 'rehearsal' | 'production'
) {
  if (env.SLACK_IMPORT_ISOLATION_VERIFIED !== 'yes')
    throw new Error(
      'Verify queue, Realtime, cron, webhooks and directory isolation; then set SLACK_IMPORT_ISOLATION_VERIFIED=yes.'
    );
  if (
    mode === 'production' &&
    (!env.SLACK_IMPORT_REHEARSAL_REPORT || !env.SLACK_IMPORT_BACKUP_REFERENCE)
  )
    throw new Error(
      'Production requires SLACK_IMPORT_REHEARSAL_REPORT and SLACK_IMPORT_BACKUP_REFERENCE.'
    );
}
