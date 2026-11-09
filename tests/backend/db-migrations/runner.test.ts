import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
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
  let folder: string | undefined;

  afterEach(() => {
    if (folder) rmSync(folder, { recursive: true, force: true });
    folder = undefined;
  });

  function fixture(secondTimestamp = 200) {
    folder = mkdtempSync(path.join(tmpdir(), 'work-migration-unit-'));
    mkdirSync(path.join(folder, 'meta'));
    writeFileSync(
      path.join(folder, 'meta/_journal.json'),
      JSON.stringify({
        entries: [
          { tag: '0001_a', when: 100, breakpoints: true },
          { tag: '0002_b', when: secondTimestamp, breakpoints: true },
        ],
      })
    );
    writeFileSync(
      path.join(folder, '0001_a.sql'),
      'SELECT 1;--> statement-breakpoint\n \n--> statement-breakpointSELECT 2;'
    );
    writeFileSync(path.join(folder, '0002_b.sql'), 'SELECT 3;');
    return folder;
  }

  it('keeps each journal entry paired with its SQL and content hash, omitting empty statements', () => {
    expect(readMigrations(fixture())).toEqual([
      {
        tag: '0001_a',
        when: 100,
        hash: '68f59c05d5ef3dd84f92fc63c0a5d5803b643d3f9ff04b980b576523d5ba2fc3',
        statements: ['SELECT 1;', 'SELECT 2;'],
      },
      {
        tag: '0002_b',
        when: 200,
        hash: '6d51e258cb323b98bf07dd6658c78c08adaf998a8e717f85e02d9c7ce869608b',
        statements: ['SELECT 3;'],
      },
    ]);
  });

  it.each([99, 100])('refuses a non-increasing journal timestamp %s', (timestamp) => {
    expect(() => readMigrations(fixture(timestamp))).toThrow('0002_b is not newer than 0001_a');
  });

  it('fails rather than silently omitting a missing SQL file', () => {
    const migrationsFolder = fixture();
    rmSync(path.join(migrationsFolder, '0002_b.sql'));
    expect(() => readMigrations(migrationsFolder)).toThrow(/0002_b\.sql/);
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

  it('uses the documented legacy URL only when DATABASE_URL is absent', () => {
    expect(deployDecision({ VERCEL_ENV: 'production', NEXT_PUBLIC_DATABASE_URL: url })).toEqual({
      run: true,
      connectionString: url,
    });
    expect(
      deployDecision({
        VERCEL_ENV: 'production',
        DATABASE_URL: url,
        NEXT_PUBLIC_DATABASE_URL: 'postgresql://legacy/other',
      })
    ).toEqual({ run: true, connectionString: url });
  });

  it('does not require credentials when skipped or given an unknown deployment target', () => {
    expect(deployDecision({ VERCEL_ENV: 'production', SKIP_DEPLOY_MIGRATIONS: '1' })).toMatchObject(
      {
        run: false,
      }
    );
    expect(deployDecision({ VERCEL_ENV: 'staging', DATABASE_URL: url })).toMatchObject({
      run: false,
    });
  });
});
