/**
 * Apply pending migrations to the database the app connects to. Refuses to run without a
 * migration ledger instead of replaying the whole history; see docs/database-migrations.md.
 */
import { pool } from '../db';
import {
  applyPendingMigrations,
  MigrationError,
  readMigrations,
} from '../lib/db-migrations/runner';

async function main() {
  const client = await pool.connect();
  try {
    await applyPendingMigrations(client, readMigrations('./db'));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(
    error instanceof MigrationError ? error.message : `Database migration failed: ${error.message}`
  );
  process.exitCode = 1;
});
