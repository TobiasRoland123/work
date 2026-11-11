import { readMigrationFiles } from 'drizzle-orm/migrator';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ClientBase } from 'pg';

/**
 * Applies the repository's SQL migrations to a database that records them in Drizzle's
 * ledger (`drizzle.__drizzle_migrations`). Unlike `migrate()` from drizzle-orm, an empty or
 * missing ledger is an error rather than a reason to replay the whole history: the earliest
 * migrations are an introspection baseline and production was migrated by hand before the
 * ledger existed. A person records the baseline once with `pnpm db:baseline`.
 */

export type MigrationFile = {
  tag: string;
  /** The journal's `when`; Drizzle stores it as the ledger's `created_at`. */
  when: number;
  hash: string;
  statements: string[];
};

export type Ledger = { schema: string; table: string };
export const drizzleLedger: Ledger = { schema: 'drizzle', table: '__drizzle_migrations' };

/** A migration problem a person must resolve; the message says what to do. */
export class MigrationError extends Error {}

// Arbitrary constant shared by every deploy, so concurrent builds apply migrations in turn.
const LOCK_KEY = 7_204_519_331;

export function readMigrations(folder: string): MigrationFile[] {
  const journal = JSON.parse(readFileSync(path.join(folder, 'meta/_journal.json'), 'utf8')) as {
    entries: { tag: string; when: number }[];
  };
  const files = readMigrationFiles({ migrationsFolder: folder });
  const migrations = journal.entries.map((entry, index) => ({
    tag: entry.tag,
    when: entry.when,
    hash: files[index].hash,
    statements: files[index].sql.filter((statement) => statement.trim()),
  }));
  // Pending migrations are found by timestamp, exactly as Drizzle does, so order must agree.
  migrations.forEach((migration, index) => {
    if (index && migration.when <= migrations[index - 1].when)
      throw new MigrationError(
        `${migration.tag} is not newer than ${migrations[index - 1].tag} in db/meta/_journal.json.`
      );
  });
  return migrations;
}

export type LedgerEntry = { hash: string; createdAt: number };

/** The migrations newer than the ledger's latest entry. */
export function pendingMigrations(
  migrations: readonly MigrationFile[],
  latest: LedgerEntry | null
): MigrationFile[] {
  if (!latest)
    throw new MigrationError(
      'The database has no migration ledger, so it is unknown which migrations it already ' +
        'has. Record its baseline once with `pnpm db:baseline` (docs/database-migrations.md). ' +
        'Nothing was applied.'
    );
  if (!migrations.some((migration) => migration.when === latest.createdAt))
    throw new MigrationError(
      `The ledger's latest entry (${latest.createdAt}) matches no migration in db/. ` +
        'The database may be ahead of this branch. Nothing was applied.'
    );
  return migrations.filter((migration) => migration.when > latest.createdAt);
}

const ledgerName = (client: ClientBase, ledger: Ledger) =>
  `${client.escapeIdentifier(ledger.schema)}.${client.escapeIdentifier(ledger.table)}`;

async function latestEntry(client: ClientBase, ledger: Ledger): Promise<LedgerEntry | null> {
  const { rows } = await client.query<{ exists: boolean }>(
    'select to_regclass($1) is not null as exists',
    [ledgerName(client, ledger)]
  );
  if (!rows[0].exists) return null;
  const latest = await client.query<{ hash: string; created_at: string }>(
    `select hash, created_at from ${ledgerName(client, ledger)} order by created_at desc limit 1`
  );
  const row = latest.rows[0];
  return row ? { hash: row.hash, createdAt: Number(row.created_at) } : null;
}

type Log = (message: string) => void;

/**
 * Apply every pending migration, each in its own transaction together with its ledger
 * entry, so a failure leaves the database at the last completed migration.
 */
export async function applyPendingMigrations(
  client: ClientBase,
  migrations: readonly MigrationFile[],
  { ledger = drizzleLedger, log = console.info }: { ledger?: Ledger; log?: Log } = {}
): Promise<string[]> {
  await client.query('select pg_advisory_lock($1)', [LOCK_KEY]);
  try {
    const pending = pendingMigrations(migrations, await latestEntry(client, ledger));
    if (!pending.length) log('Database migrations: up to date.');
    for (const migration of pending) {
      log(`Database migrations: applying ${migration.tag}`);
      await client.query('begin');
      try {
        await client.query("set local lock_timeout = '10s'");
        await client.query("set local statement_timeout = '5min'");
        for (const statement of migration.statements) await client.query(statement);
        await client.query(
          `insert into ${ledgerName(client, ledger)} (hash, created_at) values ($1, $2)`,
          [migration.hash, migration.when]
        );
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw new MigrationError(
          `${migration.tag} failed and was rolled back: ${(error as Error).message}`
        );
      }
    }
    return pending.map((migration) => migration.tag);
  } finally {
    await client.query('select pg_advisory_unlock($1)', [LOCK_KEY]);
  }
}

/**
 * Record that the database already has every migration up to and including `throughTag`.
 * Only for a ledger that is missing or empty; it runs no migration SQL.
 */
export async function recordBaseline(
  client: ClientBase,
  migrations: readonly MigrationFile[],
  throughTag: string,
  { ledger = drizzleLedger }: { ledger?: Ledger } = {}
): Promise<string[]> {
  const through = migrations.findIndex((migration) => migration.tag === throughTag);
  if (through === -1) throw new MigrationError(`No migration named ${throughTag} in db/.`);
  const applied = migrations.slice(0, through + 1);
  await client.query('select pg_advisory_lock($1)', [LOCK_KEY]);
  try {
    await client.query('begin');
    try {
      await client.query(`create schema if not exists ${client.escapeIdentifier(ledger.schema)}`);
      // The same definition drizzle-orm creates, so `migrate()` and drizzle-kit agree with it.
      await client.query(
        `create table if not exists ${ledgerName(client, ledger)} ` +
          '(id serial primary key, hash text not null, created_at bigint)'
      );
      const { rows } = await client.query(`select 1 from ${ledgerName(client, ledger)} limit 1`);
      if (rows.length)
        throw new MigrationError('The migration ledger already has entries; no baseline needed.');
      for (const migration of applied)
        await client.query(
          `insert into ${ledgerName(client, ledger)} (hash, created_at) values ($1, $2)`,
          [migration.hash, migration.when]
        );
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
    return applied.map((migration) => migration.tag);
  } finally {
    await client.query('select pg_advisory_unlock($1)', [LOCK_KEY]);
  }
}

export type DeployDecision =
  | { run: true; connectionString: string }
  | { run: false; reason: string };

/** Whether this build should migrate its database, from Vercel's build environment. */
export function deployDecision(env: Record<string, string | undefined>): DeployDecision {
  if (env.SKIP_DEPLOY_MIGRATIONS === '1')
    return { run: false, reason: 'SKIP_DEPLOY_MIGRATIONS=1 is set.' };
  const target = env.VERCEL_ENV;
  if (!target) return { run: false, reason: 'not a Vercel deployment.' };
  if (target === 'development') return { run: false, reason: 'Vercel development build.' };
  // A preview builds unmerged code; it must not migrate a database production also uses.
  if (target === 'preview' && env.DEPLOY_MIGRATIONS_PREVIEW !== '1')
    return {
      run: false,
      reason:
        'preview builds migrate only with DEPLOY_MIGRATIONS_PREVIEW=1, set when previews ' +
        'have their own database.',
    };
  if (target !== 'preview' && target !== 'production')
    return { run: false, reason: `unknown VERCEL_ENV "${target}".` };
  const connectionString = env.DATABASE_URL ?? env.NEXT_PUBLIC_DATABASE_URL;
  if (!connectionString)
    throw new MigrationError(`DATABASE_URL is not set for the ${target} environment.`);
  return { run: true, connectionString };
}
