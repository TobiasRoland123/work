import React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { requirePageUserId } from '@/lib/auth/require-user';
import { requireAdmin } from '@/lib/auth/roles';
import { listUserRoles } from '@/lib/admin/roles';
import { RoleManager } from './RoleManager';
import '../../employee-stats/employee-stats.css';
import './roles.css';

export const dynamic = 'force-dynamic';

export default async function RolesPage() {
  await requirePageUserId();
  const adminUserId = await requireAdmin();
  const entries = await listUserRoles();

  return (
    <main id="dashboard-main" className="content-page stats-page roles-page">
      <PageHeader title="Roles" subtitle="Manage access for your workspace" />
      <div className="content-page-body roles-body">
        <section className="roles-guide" aria-labelledby="role-permissions">
          <h2 id="role-permissions" className="sr-only">
            What each role can do
          </h2>
          <ul className="roles-permissions">
            <li data-role="ADMIN">
              <strong>Admin</strong>
              <p>Access all features and change other people’s roles.</p>
            </li>
            <li data-role="MANAGER">
              <strong>Manager</strong>
              <p>View employee statistics and use normal attendance features.</p>
            </li>
            <li data-role="EMPLOYEE">
              <strong>Employee</strong>
              <p>View colleagues and manage their own attendance.</p>
            </li>
          </ul>
        </section>
        <RoleManager entries={entries} adminUserId={adminUserId} />
        <p className="roles-note">
          Role changes apply on the person’s next request. Only active workspace members are listed.
          Ask another admin to change your own role.
        </p>
      </div>
    </main>
  );
}
