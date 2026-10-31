'use server';

import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/db';
import { users } from '@/db/schema';
import { activeWorkspaceMember, requireAdmin } from '@/lib/auth/roles';
import { APP_ROLES } from '@/lib/auth/role-policy';

const roleInput = z.object({
  userId: z.string().min(1).max(36),
  role: z.enum(APP_ROLES),
});

type RoleResult = { ok: true } | { ok: false; error: string };

export async function changeUserRoleAction(input: unknown): Promise<RoleResult> {
  const adminUserId = await requireAdmin();
  const parsed = roleInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Choose a person and a valid role.' };
  const { userId, role } = parsed.data;
  if (userId === adminUserId) return { ok: false, error: 'Ask another admin to change your role.' };
  const teamId = process.env.SLACK_TEAM_ID;
  if (!teamId) return { ok: false, error: 'The workspace is not configured.' };

  const result = await db.transaction(async (tx): Promise<RoleResult> => {
    // Serialize changes and re-check the caller after waiting. Another admin may have
    // revoked their role while this request was waiting for the lock.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`application-roles:${teamId}`}, 0))`
    );
    const [admin] = await tx
      .select({ userId: users.userId })
      .from(users)
      .where(
        and(
          eq(users.userId, adminUserId),
          eq(users.systemRole, 'ADMIN'),
          activeWorkspaceMember(teamId)
        )
      )
      .limit(1);
    if (!admin) return { ok: false, error: 'You no longer have permission to change roles.' };

    const [changed] = await tx
      .update(users)
      .set({ systemRole: role })
      .where(and(eq(users.userId, userId), activeWorkspaceMember(teamId)))
      .returning({ userId: users.userId });
    if (!changed)
      return { ok: false, error: 'That person is not an active member of the workspace.' };
    return { ok: true };
  });

  if (result.ok) revalidatePath('/', 'layout');
  return result;
}
