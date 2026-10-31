import { eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/db';
import { employeeStatsAccess, users } from '@/db/schema';
import {
  activeWorkspaceMember,
  adminSlackUserId,
  requireEmployeeStatsAdmin,
} from '@/lib/auth/employee-stats';

export type AccessRole = 'admin' | 'viewer' | 'none';

export type AccessEntry = {
  userId: string;
  name: string;
  email: string;
  role: AccessRole;
  /** ISO time of the grant; null for the admin and for people without access. */
  grantedAt: string | null;
  grantedBy: string | null;
};

const displayName = (first: string | null, last: string | null) =>
  [first, last].filter(Boolean).join(' ');

/** Everyone the admin can choose from, with whether they can already view the statistics. */
export async function listEmployeeStatsAccess(): Promise<AccessEntry[]> {
  // Check at the read boundary too: importing this function must never bypass the permission.
  await requireEmployeeStatsAdmin();
  const teamId = process.env.SLACK_TEAM_ID ?? '';
  const adminId = adminSlackUserId(teamId);
  const granter = alias(users, 'granter');

  const rows = await db
    .select({
      userId: users.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      slackUserId: users.slackUserId,
      grantedAt: employeeStatsAccess.grantedAt,
      grantedByUserId: employeeStatsAccess.grantedByUserId,
      granterFirstName: granter.firstName,
      granterLastName: granter.lastName,
      granterEmail: granter.email,
    })
    .from(users)
    .leftJoin(employeeStatsAccess, eq(employeeStatsAccess.userId, users.userId))
    .leftJoin(granter, eq(granter.userId, employeeStatsAccess.grantedByUserId))
    .where(activeWorkspaceMember(teamId));

  return rows
    .map((row): AccessEntry => {
      const role: AccessRole =
        adminId && row.slackUserId === adminId ? 'admin' : row.grantedAt ? 'viewer' : 'none';
      return {
        userId: row.userId,
        name: displayName(row.firstName, row.lastName) || row.email,
        email: row.email,
        role,
        grantedAt: role === 'viewer' && row.grantedAt ? row.grantedAt.toISOString() : null,
        grantedBy:
          role === 'viewer' && row.grantedByUserId
            ? displayName(row.granterFirstName, row.granterLastName) || row.granterEmail
            : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}
