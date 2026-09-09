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
  jsonb,
  boolean,
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
  'AWAY',
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
    slackUserId: varchar('slack_user_id', { length: 32 }),
    slackTeamId: varchar('slack_team_id', { length: 32 }),
    slackDeactivated: boolean('slack_deactivated').default(false).notNull(),
  },
  (table) => [
    unique('users_email_unique').on(table.email),
    unique('users_slack_identity_unique').on(table.slackTeamId, table.slackUserId),
  ]
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

export const status = pgTable(
  'status',
  {
    id: serial().primaryKey().notNull(),
    userID: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => users.userId, { onDelete: 'cascade' }),
    // Null allows a Slack description when no attendance status fits.
    status: userStatus('status').default('IN_OFFICE'),
    details: text('details'),
    time: timestamp('time'),
    fromDate: date('from_date'),
    toDate: date('to_date'),
    sourceMessageKey: text('source_message_key'),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    startsAtApproximate: boolean('starts_at_approximate').default(false).notNull(),
    endsAtApproximate: boolean('ends_at_approximate').default(false).notNull(),
    announcedAt: timestamp('announced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  },
  () => [
    pgPolicy('allow_service_role_select', {
      as: 'permissive',
      for: 'select',
      to: 'service_role',
      using: sql`true`,
    }),
  ]
).enableRLS();

// Durable inbox. Message text is cleared after processing or after 24 hours on failure.
// No public RLS policies: only the server database role may access this table.
export const slackMessages = pgTable('slack_messages', {
  messageKey: text('message_key').primaryKey(),
  teamId: text('team_id').notNull(),
  channelId: text('channel_id').notNull(),
  messageTs: text('message_ts').notNull(),
  revision: text('revision').notNull(),
  slackUserId: text('slack_user_id'),
  text: text('text'),
  state: text('state').notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).defaultNow().notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
  outcome: jsonb('outcome'),
}).enableRLS();
