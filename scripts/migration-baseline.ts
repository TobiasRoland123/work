/**
 * One-time: record which migrations an unjournaled database already has, so deploys apply
 * only the ones after it. Prints the target and changes nothing without --apply.
 *
 *   pnpm db:baseline --through 0049_status_supersessions           # dry run
 *   pnpm db:baseline --through 0049_status_supersessions --apply
 *
 * Connects like the app: DATABASE_URL with NODE_ENV=production, otherwise PG* settings.
 */
import { pool } from '../db';
import { MigrationError, readMigrations, recordBaseline } from '../lib/db-migrations/runner';

async function main() {
  const args = process.argv.slice(2);
  const through = args[args.indexOf('--through') + 1];
  if (!args.includes('--through') || !through || through.startsWith('--'))
    throw new MigrationError(
      'Pass --through <migration tag>, for example 0049_status_supersessions.'
    );
  const migrations = readMigrations('./db');
  const index = migrations.findIndex((migration) => migration.tag === through);
  if (index === -1) throw new MigrationError(`No migration named ${through} in db/.`);

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      'select current_database() as database, current_user as "user", inet_server_addr() as host'
    );
    console.info('Target:', rows[0]);
    console.info(
      `Marks ${index + 1} migrations as applied (${migrations[0].tag} … ${through}); ` +
        `${migrations.length - index - 1} would then run on the next deploy.`
    );
    if (!args.includes('--apply')) {
      console.info('Dry run. Add --apply to record the baseline.');
      return;
    }
    await recordBaseline(client, migrations, through);
    console.info('Baseline recorded.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
