import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PoolClient } from 'pg';
import { pool } from '@/db';
import {
  applyPendingMigrations,
  type Ledger,
  MigrationError,
  readMigrations,
  recordBaseline,
} from '@/lib/db-migrations/runner';

const schema = 'migtest_' + randomUUID().slice(0, 8);
const ledger: Ledger = { schema: schema + '_ledger', table: '__drizzle_migrations' };
let folder: string;
let client: PoolClient;
const silent = { ledger, log: () => {} };

function writeMigrations(files: Record<string, string>) {
  rmSync(path.join(folder, 'meta'), { recursive: true, force: true });
  mkdirSync(path.join(folder, 'meta'));
  const entries = Object.keys(files).map((tag, idx) => ({
    idx,
    version: '7',
    when: 1000 + idx,
    tag,
    breakpoints: true,
  }));
  writeFileSync(path.join(folder, 'meta/_journal.json'), JSON.stringify({ entries }));
  for (const [tag, sql] of Object.entries(files))
    writeFileSync(path.join(folder, tag + '.sql'), sql);
  return readMigrations(folder);
}

const tables = async () =>
  (
    await client.query<{ name: string }>(
      'select table_name as name from information_schema.tables where table_schema = $1 order by 1',
      [schema]
    )
  ).rows.map((row) => row.name);
const ledgerRows = async () =>
  (await client.query(`select created_at from "${ledger.schema}"."${ledger.table}" order by 1`))
    .rows.length;

describe.runIf(process.env.SLACK_TEST_DATABASE === '1')(
  'deploy migrations on isolated PostgreSQL',
  () => {
    beforeAll(async () => {
      if (process.env.PGHOST !== '127.0.0.1' || process.env.PGDATABASE !== 'work_slack_test')
        throw new Error('Dedicated local test database required');
      folder = mkdtempSync(path.join(tmpdir(), 'migrations-'));
      client = await pool.connect();
    });

    beforeEach(async () => {
      await client.query(`drop schema if exists "${schema}" cascade`);
      await client.query(`drop schema if exists "${ledger.schema}" cascade`);
      await client.query(`create schema "${schema}"`);
    });

    afterAll(async () => {
      await client.query(`drop schema if exists "${schema}" cascade`);
      await client.query(`drop schema if exists "${ledger.schema}" cascade`);
      client.release();
      await pool.end();
      rmSync(folder, { recursive: true, force: true });
    });

    const history = {
      '0000_baseline': `create table "${schema}".existing (id int);`,
      '0001_first': `create table "${schema}".first (id int);\n--> statement-breakpoint\ncreate index on "${schema}".first (id);`,
      '0002_second': `create table "${schema}".second (id int);`,
    };

    it('applies nothing to a database without a ledger', async () => {
      const migrations = writeMigrations(history);
      await expect(applyPendingMigrations(client, migrations, silent)).rejects.toThrow(
        MigrationError
      );
      expect(await tables()).toEqual([]);
    });

    it('applies only the migrations after the baseline, once', async () => {
      const migrations = writeMigrations(history);
      await client.query(`create table "${schema}".existing (id int)`);
      await recordBaseline(client, migrations, '0000_baseline', { ledger });

      await expect(applyPendingMigrations(client, migrations, silent)).resolves.toEqual([
        '0001_first',
        '0002_second',
      ]);
      expect(await tables()).toEqual(['existing', 'first', 'second']);
      await expect(applyPendingMigrations(client, migrations, silent)).resolves.toEqual([]);
      expect(await ledgerRows()).toBe(3);
    });

    it('rolls back a failing migration and keeps the ones before it', async () => {
      const migrations = writeMigrations({
        ...history,
        '0002_second': `create table "${schema}".second (id int);\n--> statement-breakpoint\nselect missing_function();`,
      });
      await recordBaseline(client, migrations, '0000_baseline', { ledger });
      await expect(applyPendingMigrations(client, migrations, silent)).rejects.toThrow(
        /0002_second failed and was rolled back/
      );
      expect(await tables()).toEqual(['first']);
      expect(await ledgerRows()).toBe(2);
    });

    it('records a baseline only once', async () => {
      const migrations = writeMigrations(history);
      await recordBaseline(client, migrations, '0001_first', { ledger });
      await expect(recordBaseline(client, migrations, '0001_first', { ledger })).rejects.toThrow(
        /already has entries/
      );
      expect(await ledgerRows()).toBe(2);
    });
  }
);
