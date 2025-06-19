import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import * as dotenv from 'dotenv';

dotenv.config();

// Create a PostgreSQL connection pool
const pool = new Pool(
  process.env.NODE_ENV === 'production'
    ? { connectionString: process.env.NEXT_PUBLIC_DATABASE_URL }
    : {
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        host: process.env.PGHOST,
        port: Number(process.env.PGPORT),
        database: process.env.PGDATABASE,
      }
);

// Create a Drizzle ORM instance with the schema
export const db = drizzle(pool, { schema });

// Export the pool for direct queries if needed
export { pool };
