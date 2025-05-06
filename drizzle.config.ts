import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

export default {
  schema: './db/schema.ts',
  out: './db',
  dialect: 'postgresql',
  dbCredentials: {
    url: `${process.env.DATABASE_URL!}${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`,
  },
} satisfies Config;
