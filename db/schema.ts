import { sql } from 'drizzle-orm';
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
  pgPolicy,
  boolean,
  primaryKey,
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
});

export const users = pgTable(
  'users',
  {
    id: serial().notNull(),
    userId: varchar('user_id', { length: 36 }).primaryKey().notNull(),
    firstName: varchar('first_name', { length: 60 }),
    lastName: varchar('last_name', { length: 255 }),
    email: varchar({ length: 100 }).notNull(),
    systemRole: systemRole('system_role').default('USER').notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    organisationId: integer('organisation_id').references(() => organisations.id, {
      onDelete: 'restrict',
    }),
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
  userId: varchar('user_id', { length: 36 })
    .notNull()
    .references(() => users.userId, { onDelete: 'cascade' }),
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
  userId: varchar('user_id', { length: 36 })
    .notNull()
    .references(() => users.userId, { onDelete: 'cascade' }),
  businessPhoneNumberId: integer('business_phone_numbers_id')
    .notNull()
    .references(() => business_phone_numbers.id),
});

// Stable app IDs and all existing relations survive the provider migration.
export const slackIdentities = pgTable('slack_identities', {
  teamId: text('team_id').notNull(),
  slackUserId: text('slack_user_id').notNull(),
  userId: varchar('user_id', { length: 36 }).notNull().references(() => users.userId, { onDelete: 'restrict' }),
  active: boolean('active').default(true).notNull(),
}, (table) => [primaryKey({ columns: [table.teamId, table.slackUserId] }), unique('slack_identity_user_unique').on(table.userId)]);

export const slackMessages = pgTable('slack_messages', {
  key: text('key').primaryKey(),
  channelId: text('channel_id').notNull(),
  messageTs: text('message_ts').notNull(),
  contentHash: text('content_hash').notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }).defaultNow().notNull(),
});

export const slackSyncState = pgTable('slack_sync_state', {
  channelId: text('channel_id').primaryKey(),
  completedAt: timestamp('completed_at', { withTimezone: true }).notNull(),
});

export const status = pgTable(
  'status',
  {
    id: serial().primaryKey().notNull(),
    userID: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => users.userId, { onDelete: 'cascade' }),
    status: userStatus('status').default('IN_OFFICE').notNull(),
    details: text('details'),
    time: timestamp('time'),
    fromDate: date('from_date'),
    toDate: date('to_date'),
    slackMessageKey: text('slack_message_key').references(() => slackMessages.key, { onDelete: 'cascade' }),
    sourceIndex: integer('source_index'),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    timePrecision: text('time_precision'),
    timeLabel: text('time_label'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    unique('status_slack_source_unique').on(table.slackMessageKey, table.sourceIndex),
    pgPolicy('allow_service_role_select', {
      as: 'permissive',
      for: 'select',
      to: 'service_role',
      using: sql`true`,
    }),
  ]
).enableRLS();
