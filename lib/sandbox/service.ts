import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { slackMessages, status, users } from '@/db/schema';
import {
  enqueueSlackEvent,
  processQueuedSlackMessage,
  processSlackInbox,
  SlackMessagePendingError,
} from '@/lib/slack/inbox';
import { ATTENDANCE_TIME_ZONE, copenhagenDate, localInstant } from '@/lib/slack/extraction';
import { extractShorthand } from '@/lib/slack/shorthand';
import { SANDBOX_CHANNEL_ID, SANDBOX_TEAM_ID } from './enabled';
import { deletedEnvelope, editedEnvelope, messageEnvelope, sandboxTs } from './envelope';

export type SandboxProfile = {
  userId: string;
  slackUserId: string;
  firstName: string | null;
  lastName: string | null;
  slackDeactivated: boolean;
};

export type SandboxInterval = {
  status: string | null;
  fromDate: string | null;
  toDate: string | null;
  startTime: string | null;
  endTime: string | null;
  startApproximate: boolean;
  endApproximate: boolean;
  details: string | null;
};

export type SandboxProcessing =
  | { kind: 'terminal'; state: string; reason: string | null; attempts: number }
  | { kind: 'retry_scheduled'; afterSeconds: number; likelyReason: string; attempts: number }
  | { kind: 'not_processed' };

export type SandboxOutcome = {
  messageKey: string;
  messageTs: string;
  revision: string;
  announcedAt: string;
  backdated: boolean;
  intake: { outcome: string; reason?: string };
  handledBy: 'shorthand' | 'model' | null;
  processing: SandboxProcessing;
  interpretation: { decision: string; reason: string | null; intervals: SandboxInterval[] } | null;
};

export type SandboxReadiness = {
  ready: boolean;
  checks: { name: string; ok: boolean; hint: string }[];
};

const HHmm = new Intl.DateTimeFormat('en-GB', {
  timeZone: ATTENDANCE_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function sandboxReadiness(env: NodeJS.ProcessEnv = process.env): SandboxReadiness {
  const checks = [
    {
      name: 'SLACK_TEAM_ID',
      ok: env.SLACK_TEAM_ID === SANDBOX_TEAM_ID,
      hint: `Set SLACK_TEAM_ID=${SANDBOX_TEAM_ID} in .env.local; the intake rejects other workspaces.`,
    },
    {
      name: 'SLACK_CHANNEL_ID',
      ok: env.SLACK_CHANNEL_ID === SANDBOX_CHANNEL_ID,
      hint: `Set SLACK_CHANNEL_ID=${SANDBOX_CHANNEL_ID} in .env.local; the intake rejects other channels.`,
    },
    {
      name: 'AUTH_SECRET',
      ok: Boolean(env.AUTH_SECRET?.trim()),
      hint: 'Set AUTH_SECRET in .env.local to sign in as a Sandbox Profile.',
    },
    {
      name: 'AI_GATEWAY_API_KEY',
      ok: Boolean(env.AI_GATEWAY_API_KEY?.trim()),
      hint: 'Set AI_GATEWAY_API_KEY in .env.local. Only shorthand messages work without it.',
    },
  ];
  return { ready: checks.every((check) => check.ok), checks };
}

export async function listSandboxProfiles(): Promise<SandboxProfile[]> {
  return db
    .select({
      userId: users.userId,
      slackUserId: users.slackUserId,
      firstName: users.firstName,
      lastName: users.lastName,
      slackDeactivated: users.slackDeactivated,
    })
    .from(users)
    .where(eq(users.slackTeamId, SANDBOX_TEAM_ID))
    .orderBy(users.firstName, users.lastName)
    .then((rows) =>
      rows.flatMap((row) => (row.slackUserId ? [{ ...row, slackUserId: row.slackUserId }] : []))
    );
}

export async function listSandboxInbox() {
  return db
    .select({
      messageKey: slackMessages.messageKey,
      messageTs: slackMessages.messageTs,
      revision: slackMessages.revision,
      slackUserId: slackMessages.slackUserId,
      state: slackMessages.state,
      attempts: slackMessages.attempts,
      outcome: slackMessages.outcome,
      nextAttemptAt: slackMessages.nextAttemptAt,
      receivedAt: slackMessages.receivedAt,
    })
    .from(slackMessages)
    .where(eq(slackMessages.teamId, SANDBOX_TEAM_ID))
    .orderBy(desc(slackMessages.receivedAt))
    .limit(50)
    .then((rows) =>
      rows.map((row) => ({
        ...row,
        reason:
          row.outcome && typeof row.outcome === 'object' && 'reason' in row.outcome
            ? String((row.outcome as { reason: unknown }).reason)
            : null,
        nextAttemptAt: row.nextAttemptAt.toISOString(),
        receivedAt: row.receivedAt.toISOString(),
      }))
    );
}

/** Copenhagen wall clock `YYYY-MM-DDTHH:mm` to an instant. Rejects DST gaps and overlaps. */
export function announcementInstant(wallClock?: string | null): Date {
  if (!wallClock) return new Date();
  const match = wallClock.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (!match) throw new Error('Announcement time must be YYYY-MM-DDTHH:mm');
  return localInstant(match[1], match[2]);
}

async function activeAuthor(slackUserId: string) {
  const [author] = await db
    .select({ id: users.userId })
    .from(users)
    .where(
      and(
        eq(users.slackTeamId, SANDBOX_TEAM_ID),
        eq(users.slackUserId, slackUserId),
        eq(users.slackDeactivated, false)
      )
    )
    .limit(1);
  return author ?? null;
}

function handledBy(text: string, instant: Date): 'shorthand' | 'model' {
  return extractShorthand(text, copenhagenDate(instant), HHmm.format(instant))
    ? 'shorthand'
    : 'model';
}

function clockOrNull(value: Date | null, dayStart: boolean) {
  if (!value) return null;
  const clock = HHmm.format(value);
  return dayStart && clock === '00:00' ? null : clock;
}

async function committedInterpretation(messageKey: string) {
  const [job] = await db
    .select({ state: slackMessages.state, outcome: slackMessages.outcome })
    .from(slackMessages)
    .where(eq(slackMessages.messageKey, messageKey));
  if (!job || job.state === 'pending' || job.state === 'deleted') return null;
  const reason =
    job.outcome && typeof job.outcome === 'object' && 'reason' in job.outcome
      ? String((job.outcome as { reason: unknown }).reason)
      : null;
  const rows = await db
    .select()
    .from(status)
    .where(eq(status.sourceMessageKey, messageKey))
    .orderBy(status.startsAt);
  const intervals: SandboxInterval[] = rows.map((row) => ({
    status: row.status,
    fromDate: row.fromDate,
    toDate: row.toDate,
    startTime: clockOrNull(row.startsAt, true),
    endTime: clockOrNull(row.endsAt, true),
    startApproximate: row.startsAtApproximate,
    endApproximate: row.endsAtApproximate,
    details: row.details,
  }));
  const decision =
    job.state === 'applied' && rows.some((row) => row.status)
      ? 'apply'
      : job.state === 'ignored' || reason === 'not_attendance'
        ? 'ignore'
        : 'review';
  return { decision, reason, intervals };
}

/** Runs the queue consumer in process and describes where the job ended up. */
async function consume(
  messageKey: string,
  revision: string,
  likelyReason: string
): Promise<SandboxProcessing> {
  let processing: SandboxProcessing;
  try {
    await processQueuedSlackMessage(messageKey, revision);
    const [job] = await db
      .select({
        state: slackMessages.state,
        outcome: slackMessages.outcome,
        attempts: slackMessages.attempts,
      })
      .from(slackMessages)
      .where(eq(slackMessages.messageKey, messageKey));
    processing = job
      ? {
          kind: 'terminal',
          state: job.state,
          reason:
            job.outcome && typeof job.outcome === 'object' && 'reason' in job.outcome
              ? String((job.outcome as { reason: unknown }).reason)
              : null,
          attempts: job.attempts,
        }
      : { kind: 'not_processed' };
  } catch (error) {
    // A retry with backoff is a normal outcome of the durable inbox, not a crash.
    if (!(error instanceof SlackMessagePendingError)) throw error;
    const [job] = await db
      .select({ attempts: slackMessages.attempts })
      .from(slackMessages)
      .where(eq(slackMessages.messageKey, messageKey));
    processing = {
      kind: 'retry_scheduled',
      afterSeconds: error.afterSeconds,
      likelyReason,
      attempts: job?.attempts ?? 0,
    };
  }
  return processing;
}

/** The inbox logs its failure reason but does not persist it; derive the likely one. */
async function likelyFailureReason(slackUserId: string) {
  if (!(await activeAuthor(slackUserId))) return 'unmapped_user';
  if (!process.env.AI_GATEWAY_API_KEY?.trim()) return 'gateway_key_missing';
  return 'extraction_failed';
}

export class SandboxInputError extends Error {}

export async function sendSandboxMessage(input: {
  slackUserId: string;
  text: string;
  announcedAt?: string | null;
}): Promise<SandboxOutcome> {
  const readiness = sandboxReadiness();
  const blocking = readiness.checks.filter(
    (check) => !check.ok && check.name !== 'AI_GATEWAY_API_KEY' && check.name !== 'AUTH_SECRET'
  );
  if (blocking.length) throw new SandboxInputError(blocking.map((check) => check.hint).join(' '));
  const text = input.text.trim();
  if (!text) throw new SandboxInputError('Write a message first.');
  const instant = announcementInstant(input.announcedAt);
  const handler = handledBy(text, instant);
  const author = await activeAuthor(input.slackUserId);
  // Fail up front instead of through five retries into review.
  if (author && handler === 'model' && !process.env.AI_GATEWAY_API_KEY?.trim())
    throw new SandboxInputError(
      'AI_GATEWAY_API_KEY is not set. The model would fail five times and land in review. Only shorthand such as "wfh" works without it.'
    );
  const messageTs = sandboxTs(instant);
  const envelope = messageEnvelope({ slackUserId: input.slackUserId, text, messageTs });
  return deliver(envelope, {
    messageTs,
    revision: messageTs,
    announcedAt: instant,
    handledBy: handler,
    slackUserId: input.slackUserId,
  });
}

export async function editSandboxMessage(input: {
  slackUserId: string;
  messageTs: string;
  text: string;
}): Promise<SandboxOutcome> {
  const text = input.text.trim();
  if (!text) throw new SandboxInputError('An edit needs text. Use delete to withdraw.');
  const instant = new Date(Number(input.messageTs) * 1000);
  const revision = sandboxTs(new Date());
  const envelope = editedEnvelope({ ...input, text, messageTs: input.messageTs, revision });
  return deliver(envelope, {
    messageTs: input.messageTs,
    revision,
    announcedAt: instant,
    handledBy: handledBy(text, instant),
    slackUserId: input.slackUserId,
  });
}

export async function deleteSandboxMessage(input: {
  slackUserId: string;
  messageTs: string;
}): Promise<SandboxOutcome> {
  const revision = sandboxTs(new Date());
  const envelope = deletedEnvelope({ ...input, revision });
  return deliver(envelope, {
    messageTs: input.messageTs,
    revision,
    announcedAt: new Date(Number(input.messageTs) * 1000),
    handledBy: null,
    slackUserId: input.slackUserId,
  });
}

async function deliver(
  envelope: unknown,
  context: {
    messageTs: string;
    revision: string;
    announcedAt: Date;
    handledBy: 'shorthand' | 'model' | null;
    slackUserId: string;
  }
): Promise<SandboxOutcome> {
  // Never write to slack_messages directly: the intake owns deduplication and revisions.
  const intake = await enqueueSlackEvent(envelope);
  const messageKey = `${SANDBOX_TEAM_ID}:${SANDBOX_CHANNEL_ID}:${context.messageTs}`;
  const base = {
    messageKey,
    messageTs: context.messageTs,
    revision: context.revision,
    announcedAt: context.announcedAt.toISOString(),
    backdated: copenhagenDate(context.announcedAt) !== copenhagenDate(new Date()),
    handledBy: context.handledBy,
  };
  if (intake.outcome === 'ignored')
    return {
      ...base,
      intake: { outcome: 'ignored', reason: intake.reason },
      processing: { kind: 'not_processed' },
      interpretation: null,
    };
  const processing =
    intake.outcome === 'queued' || intake.outcome === 'deleted'
      ? await consume(messageKey, intake.revision, await likelyFailureReason(context.slackUserId))
      : ({ kind: 'not_processed' } as const);
  return {
    ...base,
    intake: { outcome: intake.outcome },
    processing,
    interpretation: await committedInterpretation(messageKey),
  };
}

/** Lets due retries run now instead of waiting for their backoff. */
export async function runSandboxRetries() {
  return processSlackInbox(5);
}

export async function createSandboxProfile(input: { firstName: string; lastName: string }) {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName) throw new SandboxInputError('A first name is required.');
  const slug = `${firstName}-${lastName || 'x'}`
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const suffix = Math.random().toString(36).slice(2, 8);
  const [profile] = await db
    .insert(users)
    .values({
      userId: `sandbox-${slug}-${suffix}`.slice(0, 36),
      slackUserId: `U_LOCAL_${suffix.toUpperCase()}`,
      slackTeamId: SANDBOX_TEAM_ID,
      firstName,
      lastName: lastName || null,
      email: `${slug}-${suffix}@sandbox.local`,
    })
    .returning({ userId: users.userId, slackUserId: users.slackUserId });
  return profile;
}

/**
 * The delete statements behind reset. Both are scoped to the sandbox workspace; an
 * unscoped DELETE FROM status is the single most dangerous thing in this feature.
 */
export function sandboxResetStatements() {
  const sandboxUsers = db
    .select({ userId: users.userId })
    .from(users)
    .where(eq(users.slackTeamId, SANDBOX_TEAM_ID));
  return {
    status: db.delete(status).where(inArray(status.userID, sandboxUsers)),
    slackMessages: db.delete(slackMessages).where(eq(slackMessages.teamId, SANDBOX_TEAM_ID)),
  };
}

export async function resetSandboxData() {
  const statements = sandboxResetStatements();
  const deletedStatus = await statements.status.returning({ id: status.id });
  const deletedMessages = await statements.slackMessages.returning({
    key: slackMessages.messageKey,
  });
  return { status: deletedStatus.length, slackMessages: deletedMessages.length };
}
