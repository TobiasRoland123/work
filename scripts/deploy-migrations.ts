/**
 * Runs before `next build` on Vercel (see vercel.json). Applies pending migrations to the
 * deployment's database, or explains why it skipped. A failure stops the build, so the
 * previous deployment keeps serving instead of new code running against an old schema.
 */
import { Client } from 'pg';
import {
  applyPendingMigrations,
  deployDecision,
  MigrationError,
  readMigrations,
} from '../lib/db-migrations/runner';

async function main() {
  const decision = deployDecision(process.env);
  if (!decision.run) {
    console.info(`Database migrations: skipped, ${decision.reason}`);
    return;
  }
  const migrations = readMigrations('./db');
  const client = new Client({ connectionString: decision.connectionString });
  await client.connect();
  try {
    const applied = await applyPendingMigrations(client, migrations);
    if (applied.length) console.info(`Database migrations: applied ${applied.join(', ')}.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(
    error instanceof MigrationError
      ? `Database migrations: ${error.message}`
      : `Database migrations failed: ${(error as Error).message}`
  );
  process.exitCode = 1;
});
