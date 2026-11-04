import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, lte } from 'drizzle-orm';
import { db } from '@/db';
import { status, statusEchoes, users } from '@/db/schema';
import type { Status } from '@/db/types';
import {
  postSlackMessage,
  SlackApiError,
  SlackRateLimitError,
  updateSlackMessage,
} from '@/lib/slack/client';
import { isSandbox, SANDBOX_TEAM_ID } from '@/lib/sandbox/enabled';
import { sandboxTs } from '@/lib/sandbox/envelope';
import { copenhagenDate } from '@/lib/status/active';
import {
  echoContent,
  echoDueAt,
  echoPostDay,
  isEchoCancelled,
  isEchoDue,
  isEchoExpired,
  renderEcho,
  replacedEchoDays,
} from '@/lib/status/echo';
import { addDays } from '@/lib/status/week';
import { visibleStatusCondition } from '@/lib/status/visible';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Where Echoes go: Slack in deployments, nowhere in the Local Sandbox. */
export type EchoTransport = {
  post(input: {
    channel: string;
    text: string;
    username: string;
    iconUrl: string | null;
  }): Promise<{ channel: string; ts: string }>;
  update(input: { channel: string; ts: string; text: string }): Promise<void>;
};

export const slackEchoTransport: EchoTransport = {
  post: postSlackMessage,
  update: updateSlackMessage,
};

/** Sandbox Echoes live only in the database and on the /sandbox page (ADR 0001). */
export const sandboxEchoTransport: EchoTransport = {
  async post({ channel }) {
    return { channel, ts: sandboxTs() };
  },
  async update() {},
};

export const defaultEchoTransport = () => (isSandbox() ? sandboxEchoTransport : slackEchoTransport);

const RETRY_DELAY_MS = 5 * 60_000;

function retryDelay(error: unknown) {
  return error instanceof SlackRateLimitError ? error.retryAfter * 1000 : RETRY_DELAY_MS;
}

function errorCode(error: unknown) {
  if (error instanceof SlackApiError) return error.errorCode ?? 'slack_error';
  return error instanceof Error && error.message.startsWith('Missing required Slack configuration')
    ? 'missing_configuration'
    : 'post_failed';
}

function configuredChannel() {
  const channel = process.env.SLACK_CHANNEL_ID?.trim();
  if (!channel) throw new Error('Missing required Slack configuration: SLACK_CHANNEL_ID');
  return channel;
}

const statusesOf = (executor: typeof db | Transaction, userId: string) =>
  executor
    .select()
    .from(status)
    .where(and(eq(status.userID, userId), visibleStatusCondition()));

/**
 * Schedule the Echo of a Declaration the person just made about themselves, in the transaction
 * that saves it. Nothing is scheduled for statuses that are never echoed or name no weekday.
 */
export async function scheduleEcho(tx: Transaction, declaration: Status, savedAt: Date) {
  const content = echoContent(declaration);
  const postOn = content && echoPostDay(declaration, savedAt);
  if (!content || !postOn) return null;
  const [echo] = await tx
    .insert(statusEchoes)
    .values({
      ...content,
      statusId: declaration.id,
      userId: declaration.userID,
      postOn,
      nextAttemptAt: savedAt,
      createdAt: savedAt,
    })
    .onConflictDoNothing()
    .returning({ id: statusEchoes.id, postOn: statusEchoes.postOn });
  return echo ?? null;
}

export type EchoJobCounts = {
  posted: number;
  retrying: number;
  updated: number;
  failed: number;
  withdrawn: number;
};

/**
 * The 08:00 job. Settles Echoes whose day ended unposted, posts today's due Echoes once each,
 * and edits posted Echoes whose days were replaced or whose Declaration was removed. Safe to run
 * repeatedly and concurrently: a posted Echo is never posted again.
 */
export async function runEchoJob({
  now = new Date(),
  force = false,
  userId,
  transport = defaultEchoTransport(),
}: {
  now?: Date;
  /** Post today's Echoes before 08:00. Only the Local Sandbox uses this. */
  force?: boolean;
  /** Limit the run to one person, after they changed their attendance. */
  userId?: string;
  transport?: EchoTransport;
} = {}): Promise<EchoJobCounts> {
  const counts: EchoJobCounts = { posted: 0, retrying: 0, updated: 0, failed: 0, withdrawn: 0 };
  const today = copenhagenDate(now);
  const forUser = userId ? eq(statusEchoes.userId, userId) : undefined;

  const expired = await db
    .select({ id: statusEchoes.id })
    .from(statusEchoes)
    .where(and(eq(statusEchoes.state, 'scheduled'), lt(statusEchoes.postOn, today), forUser));
  for (const { id } of expired) {
    const outcome = await settleExpired(id, now);
    if (outcome) counts[outcome]++;
  }

  if (force || now >= echoDueAt(today)) {
    const due = await db
      .select({ id: statusEchoes.id })
      .from(statusEchoes)
      .where(
        and(
          eq(statusEchoes.state, 'scheduled'),
          eq(statusEchoes.postOn, today),
          isNotNull(statusEchoes.statusId),
          lte(statusEchoes.nextAttemptAt, now),
          forUser
        )
      )
      .orderBy(statusEchoes.id);
    for (const { id } of due) {
      const outcome = await postEcho(id, { now, force, transport });
      if (outcome) counts[outcome]++;
    }
  }

  const posted = await db
    .select({ id: statusEchoes.id })
    .from(statusEchoes)
    .where(
      and(
        eq(statusEchoes.state, 'posted'),
        isNull(statusEchoes.deletedInSlackAt),
        // A removal on an Echo's last day still reaches Slack if that edit had to wait a day.
        gte(statusEchoes.toDate, addDays(today, -1)),
        forUser
      )
    );
  for (const { id } of posted) if (await syncPostedEcho(id, { now, transport })) counts.updated++;
  return counts;
}

/** Bring one person's Echoes up to date right after they changed their attendance. */
export function syncUserEchoes(userId: string, options: { transport?: EchoTransport } = {}) {
  return runEchoJob({ userId, ...options });
}

async function lockEcho(tx: Transaction, id: number) {
  // Skip rows another run holds: that run is posting or editing this Echo right now.
  const [echo] = await tx
    .select()
    .from(statusEchoes)
    .where(eq(statusEchoes.id, id))
    .for('update', { skipLocked: true });
  return echo;
}

async function settleExpired(id: number, now: Date) {
  return db.transaction(async (tx) => {
    const echo = await lockEcho(tx, id);
    if (!echo || echo.state !== 'scheduled' || !isEchoExpired(echo.postOn, now)) return null;
    const statuses = await statusesOf(tx, echo.userId);
    // Only an Echo that still had something to announce counts as not posted.
    const state = isEchoCancelled(echo, replacedEchoDays(echo, echo.statusId, statuses))
      ? ('withdrawn' as const)
      : ('failed' as const);
    await tx.update(statusEchoes).set({ state }).where(eq(statusEchoes.id, id));
    return state;
  });
}

async function postEcho(
  id: number,
  { now, force, transport }: { now: Date; force: boolean; transport: EchoTransport }
) {
  return db.transaction(async (tx) => {
    const echo = await lockEcho(tx, id);
    if (
      !echo ||
      echo.state !== 'scheduled' ||
      echo.statusId === null ||
      echo.nextAttemptAt > now ||
      !isEchoDue(echo.postOn, now, force)
    )
      return null;
    const statuses = await statusesOf(tx, echo.userId);
    const replaced = replacedEchoDays(echo, echo.statusId, statuses);
    // Everything was replaced before the Echo's day: there is nothing left to announce.
    if (isEchoCancelled(echo, replaced)) return null;
    const [person] = await tx
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        profilePicture: users.profilePicture,
      })
      .from(users)
      .where(eq(users.userId, echo.userId));
    const text = renderEcho(echo, replaced);
    try {
      const posted = await transport.post({
        channel: configuredChannel(),
        text,
        username: echoUsername(person),
        iconUrl: echoIconUrl(person?.profilePicture),
      });
      await tx
        .update(statusEchoes)
        .set({
          state: 'posted',
          channelId: posted.channel,
          ts: posted.ts,
          postedText: text,
          postedAt: now,
          attempts: echo.attempts + 1,
          lastError: null,
        })
        .where(eq(statusEchoes.id, id));
      return 'posted' as const;
    } catch (error) {
      // Saving the Declaration already succeeded; a failed post is retried until its day ends.
      const code = errorCode(error);
      console.warn('echo_post', { echoId: id, outcome: 'retry', reason: code });
      await tx
        .update(statusEchoes)
        .set({
          attempts: echo.attempts + 1,
          lastError: code,
          nextAttemptAt: new Date(now.getTime() + retryDelay(error)),
        })
        .where(eq(statusEchoes.id, id));
      return 'retrying' as const;
    }
  });
}

async function syncPostedEcho(
  id: number,
  { now, transport }: { now: Date; transport: EchoTransport }
) {
  return db.transaction(async (tx) => {
    const echo = await lockEcho(tx, id);
    if (!echo || echo.state !== 'posted' || !echo.channelId || !echo.ts || echo.deletedInSlackAt)
      return false;
    const statuses = await statusesOf(tx, echo.userId);
    const text = renderEcho(echo, replacedEchoDays(echo, echo.statusId, statuses));
    if (text === echo.postedText) return false;
    try {
      await transport.update({ channel: echo.channelId, ts: echo.ts, text });
      await tx.update(statusEchoes).set({ postedText: text }).where(eq(statusEchoes.id, id));
      return true;
    } catch (error) {
      if (error instanceof SlackApiError && error.errorCode === 'message_not_found') {
        await tx.update(statusEchoes).set({ deletedInSlackAt: now }).where(eq(statusEchoes.id, id));
        return false;
      }
      // The next run compares the text again and retries the edit.
      console.warn('echo_update', { echoId: id, outcome: 'retry', reason: errorCode(error) });
      return false;
    }
  });
}

function echoUsername(
  person: { firstName: string | null; lastName: string | null; email: string } | undefined
) {
  if (!person) return 'Wørk';
  return (
    [person.firstName, person.lastName].filter(Boolean).join(' ') || person.email.split('@')[0]
  );
}

function echoIconUrl(url: string | null | undefined) {
  if (!url) return null;
  try {
    return new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/**
 * Remember that someone deleted an Echo in Slack, so it is never edited again. Returns whether the
 * message was an Echo; its Declaration is left exactly as it was.
 */
export async function markEchoDeletedInSlack(channelId: string, ts: string, now = new Date()) {
  const rows = await db
    .update(statusEchoes)
    .set({ deletedInSlackAt: now })
    .where(and(eq(statusEchoes.channelId, channelId), eq(statusEchoes.ts, ts)))
    .returning({ id: statusEchoes.id });
  return rows.length > 0;
}

/** Declarations whose Echo could not be posted on its day, shown only to the person. */
export async function notPostedEchoStatusIds(
  statuses: readonly Status[],
  now = new Date()
): Promise<Set<number>> {
  const ids = statuses.map((row) => row.id);
  if (!ids.length) return new Set();
  const echoes = await db.select().from(statusEchoes).where(inArray(statusEchoes.statusId, ids));
  return new Set(
    echoes.flatMap((echo) =>
      echo.statusId !== null &&
      (echo.state === 'failed' ||
        (echo.state === 'scheduled' &&
          isEchoExpired(echo.postOn, now) &&
          !isEchoCancelled(echo, replacedEchoDays(echo, echo.statusId, statuses))))
        ? [echo.statusId]
        : []
    )
  );
}

export type SandboxEcho = {
  id: number;
  name: string;
  profilePicture: string | null;
  text: string;
  postedAt: string;
};

/** Sandbox Echoes as the channel would show them, newest first, plus those still waiting. */
export async function listSandboxEchoes() {
  const rows = await db
    .select({
      echo: statusEchoes,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      profilePicture: users.profilePicture,
    })
    .from(statusEchoes)
    .innerJoin(users, eq(users.userId, statusEchoes.userId))
    .where(eq(users.slackTeamId, SANDBOX_TEAM_ID))
    .orderBy(desc(statusEchoes.postedAt), desc(statusEchoes.id))
    .limit(100);
  const posted: SandboxEcho[] = rows.flatMap(({ echo, ...person }) =>
    echo.state === 'posted' && echo.postedText && echo.postedAt
      ? [
          {
            id: echo.id,
            name: echoUsername(person),
            profilePicture: echoIconUrl(person.profilePicture),
            text: echo.postedText,
            postedAt: echo.postedAt.toISOString(),
          },
        ]
      : []
  );
  const waiting = rows
    .filter(({ echo }) => echo.state === 'scheduled' && echo.statusId !== null)
    .map(({ echo, ...person }) => ({
      id: echo.id,
      name: echoUsername(person),
      postOn: echo.postOn,
    }))
    .sort((a, b) => a.postOn.localeCompare(b.postOn));
  return { posted, waiting };
}
