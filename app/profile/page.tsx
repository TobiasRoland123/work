import SlackImportNotice from '@/components/SlackImportNotice';
import ProfileInfo from '@/components/ui/ProfileInfo/ProfileInfo';
import { requirePageUserId } from '@/lib/auth/require-user';
import { userService } from '@/lib/services/userService';
import { PageHeader } from '@/components/layout/PageHeader';

export default async function ProfilePage() {
  const userId = await requirePageUserId();
  const user = await userService.getUserById(userId);
  return (
    <main id="dashboard-main" className="content-page">
      <PageHeader title="Profile" subtitle="Your information and attendance" userId={userId} />
      <div className="content-page-body">
        {user ? <ProfileInfo user={user} /> : <p>Your profile could not be found.</p>}
        <SlackImportNotice userId={userId} />
      </div>
    </main>
  );
}
