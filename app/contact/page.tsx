import { requirePageUserId } from '@/lib/auth/require-user';
import { userService } from '@/lib/services/userService';
import { PageHeader } from '@/components/layout/PageHeader';
import ContactDirectory from '@/components/directory/ContactDirectory';

export const dynamic = 'force-dynamic';

export default async function ContactPage() {
  const userId = await requirePageUserId();
  const users = await userService.getAllUsers(false);
  return (
    <main id="dashboard-main" className="content-page">
      <PageHeader title="Contact" subtitle="Your colleagues, in one place" userId={userId} />
      <div className="content-page-body">
        <ContactDirectory users={users} />
      </div>
    </main>
  );
}
