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
  numeric,
  index,
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
  'REMOTE',
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
    canReviewMessages: boolean('can_review_messages').default(false).notNull(),
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

// People the stats admin has allowed to view employee statistics. The admin is identified by
// Slack identity in code, never by a row here. No public RLS policies: only the server database
// role may access this table, and no profile or user-update action may touch it.
export const employeeStatsAccess = pgTable('employee_stats_access', {
  userId: varchar('user_id', { length: 36 })
    .primaryKey()
    .notNull()
    .references(() => users.userId, { onDelete: 'cascade' }),
  grantedByUserId: varchar('granted_by_user_id', { length: 36 }).references(() => users.userId, {
    onDelete: 'set null',
  }),
  grantedAt: timestamp('granted_at', { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();

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
    emoji: text('emoji'),
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

// Durable inbox. Raw processing text is cleared at terminal outcomes; reviewText retains
// bounded input only when the latest revision did not create an attendance status.
// No public RLS policies: only the server database role may access this table.
export const slackMessages = pgTable('slack_messages', {
  messageKey: text('message_key').primaryKey(),
  teamId: text('team_id').notNull(),
  channelId: text('channel_id').notNull(),
  messageTs: text('message_ts').notNull(),
  revision: text('revision').notNull(),
  slackUserId: text('slack_user_id'),
  text: text('text'),
  reviewText: text('review_text'),
  state: text('state').notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).defaultNow().notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
  outcome: jsonb('outcome'),
  convertedToStatus: boolean('converted_to_status'),
  processedAt: timestamp('processed_at', { withTimezone: true }),
}).enableRLS();

// One row per attempted AI request. Keep it separate from Slack messages so
// edits, deletion, and inbox cleanup cannot erase costs already incurred.
export const slackAiUsage = pgTable(
  'slack_ai_usage',
  {
    id: text('id').primaryKey(),
    messageKey: text('message_key').notNull(),
    revision: text('revision').notNull(),
    teamId: text('team_id').notNull(),
    channelId: text('channel_id').notNull(),
    model: text('model').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    costUsd: numeric('cost_usd', { precision: 20, scale: 12 }),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    responseId: text('response_id'),
    state: text('state').default('started').notNull(),
  },
  (table) => [
    index('slack_ai_usage_message_key_idx').on(table.messageKey),
    index('slack_ai_usage_team_channel_started_idx').on(
      table.teamId,
      table.channelId,
      table.startedAt
    ),
  ]
).enableRLS();

// One row per successfully handled Slack message, retained through edits/deletion.
// AI usage is also consulted by the dashboard for attempts after the first handling.
export const slackMessageProcessing = pgTable(
  'slack_message_processing',
  {
    messageKey: text('message_key').primaryKey(),
    teamId: text('team_id').notNull(),
    channelId: text('channel_id').notNull(),
    handledAt: timestamp('handled_at', { withTimezone: true }).defaultNow().notNull(),
    usedAi: boolean('used_ai').notNull(),
  },
  (table) => [
    index('slack_message_processing_team_channel_handled_idx').on(
      table.teamId,
      table.channelId,
      table.handledAt
    ),
  ]
).enableRLS();

// Human review labels an extraction result without changing the attendance status.
// Keep feedback bound to the exact Slack revision so edits cannot inherit stale labels.
export const slackMessageFeedback = pgTable(
  'slack_message_feedback',
  {
    messageKey: text('message_key')
      .notNull()
      .references(() => slackMessages.messageKey, { onDelete: 'cascade' }),
    revision: text('revision').notNull(),
    preferredStatus: userStatus('preferred_status').notNull(),
    note: varchar('note', { length: 2000 }),
    reviewerUserId: varchar('reviewer_user_id', { length: 36 }).references(() => users.userId, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique('slack_message_feedback_revision_unique').on(table.messageKey, table.revision)]
).enableRLS();

// A person's own correction of an imported (AI-derived) Declaration. The original Declaration
// stays untouched; the correction is a newer user Declaration linked here, and this row keeps
// the error for quality review after either Declaration is removed or replaced.
// No public RLS policies: only the server database role may access this table.
export const statusCorrections = pgTable(
  'status_corrections',
  {
    id: serial().primaryKey().notNull(),
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => users.userId, { onDelete: 'cascade' }),
    originalStatusId: integer('original_status_id').references(() => status.id, {
      onDelete: 'set null',
    }),
    correctionStatusId: integer('correction_status_id').references(() => status.id, {
      onDelete: 'set null',
    }),
    sourceMessageKey: text('source_message_key').notNull(),
    // Null when the inbox no longer identifies the revision that produced the Declaration.
    sourceRevision: text('source_revision'),
    originalStatus: userStatus('original_status'),
    originalDetails: text('original_details'),
    correctedStatus: userStatus('corrected_status').notNull(),
    fromDate: date('from_date').notNull(),
    toDate: date('to_date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('status_corrections_correction_unique')
      .on(
        table.userId,
        table.sourceMessageKey,
        table.sourceRevision,
        table.correctedStatus,
        table.fromDate,
        table.toDate
      )
      .nullsNotDistinct(),
    index('status_corrections_created_idx').on(table.createdAt),
  ]
).enableRLS();

/** Attendance read from a phrase, with dates as day offsets from the message's Copenhagen date. */
export type ShorthandTemplate = {
  intervals: {
    status: (typeof userStatus.enumValues)[number];
    fromOffset: number;
    toOffset: number;
    startTime: string | null;
    endTime: string | null;
    startApproximate: boolean;
    endApproximate: boolean;
    /** Case-folded verbatim excerpt; matched case-insensitively in each new message. */
    comment: string | null;
  }[];
};

// One row per learned phrase in a workspace channel. An active row answers matching messages
// without AI; a blocked row keeps a phrase whose readings conflicted or were corrected from
// being learned again. Rows are kept for investigation.
// No public RLS policies: only the server database role may access this table.
export const learnedShorthands = pgTable(
  'learned_shorthands',
  {
    id: serial().primaryKey().notNull(),
    teamId: text('team_id').notNull(),
    channelId: text('channel_id').notNull(),
    phrase: text('phrase').notNull(),
    template: jsonb('template').$type<ShorthandTemplate>().notNull(),
    state: text('state').$type<'active' | 'blocked'>().notNull(),
    // AI readings of the phrase that agreed with the template when it was promoted or blocked.
    occurrences: integer('occurrences').notNull(),
    promotedAt: timestamp('promoted_at', { withTimezone: true }),
    blockedAt: timestamp('blocked_at', { withTimezone: true }),
    blockedReason: text('blocked_reason').$type<'conflict' | 'correction'>(),
    blockedByCorrectionId: integer('blocked_by_correction_id').references(
      () => statusCorrections.id,
      { onDelete: 'set null' }
    ),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('learned_shorthands_phrase_unique').on(table.teamId, table.channelId, table.phrase),
  ]
).enableRLS();

// Evidence for learned shorthands: how the latest processed revision of a Slack message was read
// when its whole text is a learnable phrase. Keyed by message, so retries, reprocessing and edits
// replace the evidence instead of adding to it.
// No public RLS policies: only the server database role may access this table.
export const shorthandObservations = pgTable(
  'shorthand_observations',
  {
    messageKey: text('message_key')
      .primaryKey()
      .references(() => slackMessages.messageKey, { onDelete: 'cascade' }),
    revision: text('revision').notNull(),
    teamId: text('team_id').notNull(),
    channelId: text('channel_id').notNull(),
    phrase: text('phrase').notNull(),
    template: jsonb('template').$type<ShorthandTemplate>().notNull(),
    source: text('source').$type<'model' | 'learned'>().notNull(),
    learnedShorthandId: integer('learned_shorthand_id').references(() => learnedShorthands.id, {
      onDelete: 'set null',
    }),
    correctedAt: timestamp('corrected_at', { withTimezone: true }),
    correctionId: integer('correction_id').references(() => statusCorrections.id, {
      onDelete: 'set null',
    }),
    observedAt: timestamp('observed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('shorthand_observations_phrase_idx').on(table.teamId, table.channelId, table.phrase),
  ]
).enableRLS();
