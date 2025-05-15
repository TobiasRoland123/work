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
  organisationName: varchar('organisation_name', { length: 255 }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
});

export const users = pgTable(
  'users',
  {
    id: serial().primaryKey().notNull(),
    userId: varchar('user_id', { length: 36 }),
    firstName: varchar('first_name', { length: 60 }),
    lastName: varchar('last_name', { length: 255 }),
    email: varchar({ length: 100 }).notNull(),
    systemRole: systemRole('system_role').default('USER').notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    organisationId: integer('organisation_id').references(() => organisations.id),
    mobilePhone: varchar('mobile_phone', { length: 20 }),
    profilePicture: text('profile_picture'),
  },
  (table) => [unique('users_email_unique').on(table.email)]
);

export const organisation_roles = pgTable('organisation_roles', {
  id: serial().primaryKey().notNull(),
  role_name: varchar('role_name', { length: 255 }),
});

export const users_organisation_roles = pgTable('users_organisation_roles', {
  id: serial().primaryKey().notNull(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  organisationRoleId: integer('organisation_role_id')
    .notNull()
    .references(() => organisation_roles.id),
});

export const business_phone_numbers = pgTable('business_phone_numbers', {
  id: serial().primaryKey().notNull(),
  businessPhoneNumber: varchar('business_phone_numbers', { length: 20 }),
});

export const users_business_phone_numbers = pgTable('users_business_phone_numbers', {
  id: serial().primaryKey().notNull(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  businessPhoneNumberId: integer('business_phone_numbers_id')
    .notNull()
    .references(() => business_phone_numbers.id),
});

export const status = pgTable('status', {
  id: serial().primaryKey().notNull(),
  userID: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  status: userStatus('status').default('IN_OFFICE').notNull(),
  details: text('details'),
  time: timestamp('time', { mode: 'string' }),
  fromDate: date('from_date'),
  toDate: date('to_date'),
});
