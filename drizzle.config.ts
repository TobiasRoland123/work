import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config({
  path:
    process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test'
      ? '.env'
      : '.env.local',
  override: process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test',
});

export default {
  schema: './db/schema.ts',
  out: './db',
  dialect: 'postgresql',
  dbCredentials:
    process.env.NODE_ENV === 'production'
      ? { url: `${process.env.DATABASE_URL ?? process.env.NEXT_PUBLIC_DATABASE_URL}` }
      : {
          host: process.env.PGHOST!,
          port: Number(process.env.PGPORT),
          user: process.env.PGUSER,
          password: process.env.PGPASSWORD,
          database: process.env.PGDATABASE!,
        },
} satisfies Config;
