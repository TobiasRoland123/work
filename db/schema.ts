import { pgTable, unique, serial, varchar, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const systemRole = pgEnum('system_role', ['ADMIN', 'USER', 'GUEST']);

export const users = pgTable(
  'users',
  {
    id: serial().primaryKey().notNull(),
    firstName: varchar('first_name', { length: 20 }),
    lastName: text('last_name'),
    email: text().notNull(),
    systemRole: systemRole('system_role').default('USER').notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  },
  table => [unique('users_email_unique').on(table.email)]
);
