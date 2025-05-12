import {
  pgTable,
  unique,
  serial,
  varchar,
  text,
  timestamp,
  pgEnum,
  integer,
  date,
} from 'drizzle-orm/pg-core';

export const systemRole = pgEnum('system_role', ['ADMIN', 'USER', 'GUEST']);
export const userStatus = pgEnum('user_status', [
  'IN_OFFICE',
  'FROM_HOME',
  'AT_CLIENT',
  'SICK',
  'IN_LATE',
  'LEAVING_EARLY',
  'VACATION',
  'CHILD_SICK',
  'ON_LEAVE',
]);

export const organisations = pgTable('organisations', {
  id: serial().primaryKey().notNull(),
  organisationName: text('organisation_name'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
});

export const users = pgTable(
  'users',
  {
    id: serial().primaryKey().notNull(),
    firstName: varchar('first_name', { length: 20 }),
    lastName: text('last_name'),
    email: text().notNull(),
    systemRole: systemRole('system_role').default('USER').notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    organisationId: integer('organisation_id').references(() => organisations.id),
  },
  (table) => [unique('users_email_unique').on(table.email)]
);

export const organisation_roles = pgTable('organisation_roles', {
  id: serial().primaryKey().notNull(),
  role_name: text('role_name'),
});

export const users_organisation_roles = pgTable('users_organisation_roles', {
  id: serial().primaryKey().notNull(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  organisationRoleId: integer('organisation_role_id')
    .notNull()
    .references(() => organisation_roles.id),
});

export const status = pgTable('status', {
  id: serial().primaryKey().notNull(),
  userID: integer('user_id')
    .notNull()
    .references(() => users.id),
  status: userStatus('status').default('IN_OFFICE').notNull(),
  details: text('details'),
  time: timestamp('time', { mode: 'string' }),
  fromDate: date('from_date'),
  toDate: date('to_date'),
});
