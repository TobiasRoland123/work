import { redirect } from 'next/navigation';
import { requirePageUserId } from '@/lib/auth/require-user';
import { requireAdmin } from '@/lib/auth/roles';

export const dynamic = 'force-dynamic';

export default async function EmployeeStatsAccessPage() {
  await requirePageUserId();
  await requireAdmin();
  redirect('/admin/roles');
}
