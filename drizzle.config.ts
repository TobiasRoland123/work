import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

export default {
  schema: './db/schema.ts',
  out: './db',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.NODE_ENV === 'production'? `${process.env.DATABASE_URL}` :`${process.env.DATABASE_LOCALE_URL!}${process.env.PGPORT}/${process.env.PGDATABASE}`,
  },
} satisfies Config;
