import { pushSchema } from 'drizzle-kit/api';
import { drizzle } from 'drizzle-orm/node-postgres';
import { pool } from '../db';
import * as schema from '../db/schema';
import { ensureServiceRole } from './local-database.mjs';

export async function prepareTestDatabase() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Test database setup requires NODE_ENV=test.');
  }

  await ensureServiceRole(pool);
  // The CLI can log a failed push and exit successfully. The API propagates SQL errors.
  const { apply } = await pushSchema(schema, drizzle(pool));
  await apply();
}

if (process.argv[1]?.endsWith('scripts/prepare-test-database.ts')) {
  prepareTestDatabase()
    .then(() => console.info('Test database schema is ready.'))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
