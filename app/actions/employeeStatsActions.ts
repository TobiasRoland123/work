'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/db';
import { employeeStatsAccess, users } from '@/db/schema';
import { activeWorkspaceMember, requireEmployeeStatsAdmin } from '@/lib/auth/employee-stats';

const accessInput = z.object({ userId: z.string().min(1).max(36) });

type AccessResult = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath('/employee-stats');
  revalidatePath('/employee-stats/access');
}

// Every action re-checks that the caller is the admin. A hidden button is not a permission.
export async function grantEmployeeStatsAccessAction(input: {
  userId: string;
}): Promise<AccessResult> {
  const adminUserId = await requireEmployeeStatsAdmin();
  const parsed = accessInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'That person could not be found.' };
  const { userId } = parsed.data;
  if (userId === adminUserId) return { ok: false, error: 'The admin always has access.' };

  const [person] = await db
    .select({ userId: users.userId })
    .from(users)
    .where(and(eq(users.userId, userId), activeWorkspaceMember(process.env.SLACK_TEAM_ID ?? '')))
    .limit(1);
  if (!person) return { ok: false, error: 'That person is not an active member of the workspace.' };

  // An existing grant keeps its original date and the admin who gave it.
  await db
    .insert(employeeStatsAccess)
    .values({ userId, grantedByUserId: adminUserId })
    .onConflictDoNothing();
  refresh();
  return { ok: true };
}

export async function revokeEmployeeStatsAccessAction(input: {
  userId: string;
}): Promise<AccessResult> {
  await requireEmployeeStatsAdmin();
  const parsed = accessInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'That person could not be found.' };

  await db.delete(employeeStatsAccess).where(eq(employeeStatsAccess.userId, parsed.data.userId));
  refresh();
  return { ok: true };
}
