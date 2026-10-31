import { db } from '@/db';
import { users } from '@/db/schema';
import { activeWorkspaceMember, requireAdmin } from '@/lib/auth/roles';
import type { AppRole } from '@/lib/auth/role-policy';

export type RoleEntry = {
  userId: string;
  name: string;
  email: string;
  role: AppRole;
};

export async function listUserRoles(): Promise<RoleEntry[]> {
  await requireAdmin();
  const rows = await db
    .select({
      userId: users.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      role: users.systemRole,
    })
    .from(users)
    .where(activeWorkspaceMember(process.env.SLACK_TEAM_ID ?? ''));

  return rows
    .map(({ firstName, lastName, ...row }) => ({
      ...row,
      name: [firstName, lastName].filter(Boolean).join(' ') || row.email,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}
