'use server';
import { z } from 'zod';
import { auth, signIn, signOut } from '@/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { assertSandbox } from '@/lib/sandbox/enabled';
import { SANDBOX_PROVIDER_ID } from '@/lib/sandbox/auth';
import { seedSandboxProfiles } from '@/lib/sandbox/profiles';
import {
  createSandboxProfile,
  deleteSandboxMessage,
  editSandboxMessage,
  listSandboxInbox,
  listSandboxProfiles,
  resetSandboxData,
  runSandboxRetries,
  sandboxReadiness,
  SandboxInputError,
  sendSandboxMessage,
} from '@/lib/sandbox/service';

const slackUserId = z.string().regex(/^U[A-Z0-9_]{1,31}$/);
const messageTs = z.string().regex(/^\d{10,}\.[0-9]{6}$/);
const text = z.string().max(12000);

function failure(error: unknown) {
  // Sandbox input mistakes are shown verbatim; anything else stays a generic message.
  return {
    ok: false as const,
    error: error instanceof SandboxInputError ? error.message : 'The sandbox action failed.',
  };
}

export async function getSandboxOverview() {
  assertSandbox();
  const session = await auth();
  const signedIn =
    session?.provider === 'slack' && session.userId
      ? await db
          .select({ userId: users.userId, firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(eq(users.userId, session.userId))
          .limit(1)
          .then(([row]) => (row ? { ...row, sandbox: session.sandbox === true } : null))
      : null;
  return {
    readiness: sandboxReadiness(),
    profiles: await listSandboxProfiles(),
    inbox: await listSandboxInbox(),
    signedIn,
  };
}

export async function sendSandboxMessageAction(input: {
  slackUserId: string;
  text: string;
  announcedAt?: string | null;
}) {
  assertSandbox();
  try {
    const parsed = z
      .object({ slackUserId, text, announcedAt: z.string().nullable().optional() })
      .parse(input);
    return { ok: true as const, result: await sendSandboxMessage(parsed) };
  } catch (error) {
    return failure(error);
  }
}

export async function editSandboxMessageAction(input: {
  slackUserId: string;
  messageTs: string;
  text: string;
}) {
  assertSandbox();
  try {
    const parsed = z.object({ slackUserId, messageTs, text }).parse(input);
    return { ok: true as const, result: await editSandboxMessage(parsed) };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteSandboxMessageAction(input: {
  slackUserId: string;
  messageTs: string;
}) {
  assertSandbox();
  try {
    const parsed = z.object({ slackUserId, messageTs }).parse(input);
    return { ok: true as const, result: await deleteSandboxMessage(parsed) };
  } catch (error) {
    return failure(error);
  }
}

export async function runSandboxRetriesAction() {
  assertSandbox();
  try {
    return { ok: true as const, counts: await runSandboxRetries() };
  } catch (error) {
    return failure(error);
  }
}

export async function createSandboxProfileAction(input: { firstName: string; lastName: string }) {
  assertSandbox();
  try {
    const parsed = z
      .object({ firstName: z.string().max(60), lastName: z.string().max(255) })
      .parse(input);
    return { ok: true as const, profile: await createSandboxProfile(parsed) };
  } catch (error) {
    return failure(error);
  }
}

export async function seedSandboxProfilesAction() {
  assertSandbox();
  try {
    return { ok: true as const, ...(await seedSandboxProfiles()) };
  } catch (error) {
    return failure(error);
  }
}

export async function resetSandboxDataAction() {
  assertSandbox();
  try {
    return { ok: true as const, deleted: await resetSandboxData() };
  } catch (error) {
    return failure(error);
  }
}

export async function signInAsSandboxProfileAction(formData: FormData) {
  assertSandbox();
  const userId = z.string().min(1).max(36).parse(formData.get('userId'));
  await signIn(SANDBOX_PROVIDER_ID, { userId, redirectTo: '/sandbox' });
}

export async function signOutSandboxAction() {
  assertSandbox();
  await signOut({ redirectTo: '/sandbox' });
}
