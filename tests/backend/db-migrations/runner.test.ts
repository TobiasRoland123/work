import { describe, expect, it } from 'vitest';
import {
  deployDecision,
  MigrationError,
  pendingMigrations,
  readMigrations,
  type MigrationFile,
} from '@/lib/db-migrations/runner';

const migration = (tag: string, when: number): MigrationFile => ({
  tag,
  when,
  hash: tag,
  statements: [],
});
const all = [migration('0001_a', 100), migration('0002_b', 200), migration('0003_c', 300)];

describe('pendingMigrations', () => {
  it('returns the migrations after the ledger’s latest entry', () => {
    expect(pendingMigrations(all, { hash: '0001_a', createdAt: 100 }).map((m) => m.tag)).toEqual([
      '0002_b',
      '0003_c',
    ]);
    expect(pendingMigrations(all, { hash: '0003_c', createdAt: 300 })).toEqual([]);
  });

  it('refuses to replay history when the database has no ledger', () => {
    expect(() => pendingMigrations(all, null)).toThrow(MigrationError);
    expect(() => pendingMigrations(all, null)).toThrow(/pnpm db:baseline/);
  });

  it('refuses a ledger that points at a migration this branch does not have', () => {
    expect(() => pendingMigrations(all, { hash: 'x', createdAt: 250 })).toThrow(/ahead/);
  });
});

describe('readMigrations', () => {
  it('reads the repository’s journal in order with Drizzle’s hashes', () => {
    const migrations = readMigrations('./db');
    expect(migrations.length).toBeGreaterThan(50);
    expect(migrations.at(-1)?.tag).toMatch(/^\d{4}_/);
    expect(migrations.every((m, i) => !i || m.when > migrations[i - 1].when)).toBe(true);
    expect(migrations.every((m) => /^[0-9a-f]{64}$/.test(m.hash))).toBe(true);
  });
});

describe('deployDecision', () => {
  const url = 'postgresql://example/db';

  it('migrates production deployments', () => {
    expect(deployDecision({ VERCEL_ENV: 'production', DATABASE_URL: url })).toEqual({
      run: true,
      connectionString: url,
    });
  });

  it('leaves previews alone unless they have their own database', () => {
    expect(deployDecision({ VERCEL_ENV: 'preview', DATABASE_URL: url })).toMatchObject({
      run: false,
    });
    expect(
      deployDecision({ VERCEL_ENV: 'preview', DATABASE_URL: url, DEPLOY_MIGRATIONS_PREVIEW: '1' })
    ).toEqual({ run: true, connectionString: url });
  });

  it('never migrates outside Vercel or when skipped', () => {
    expect(deployDecision({ DATABASE_URL: url })).toMatchObject({ run: false });
    expect(deployDecision({ VERCEL_ENV: 'development', DATABASE_URL: url })).toMatchObject({
      run: false,
    });
    expect(
      deployDecision({ VERCEL_ENV: 'production', DATABASE_URL: url, SKIP_DEPLOY_MIGRATIONS: '1' })
    ).toMatchObject({ run: false });
  });

  it('fails the build when a migrating deployment has no database URL', () => {
    expect(() => deployDecision({ VERCEL_ENV: 'production' })).toThrow(/DATABASE_URL/);
  });
});
