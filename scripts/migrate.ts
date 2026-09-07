import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from '../db';

async function main() {
  try { await migrate(db, { migrationsFolder: './db' }); }
  finally { await pool.end(); }
}
main().catch(() => { console.error('Database migration failed. Check the database migration baseline and connection.'); process.exitCode = 1; });
