import SlackImportNotice from '@/components/SlackImportNotice';
import ProfileInfo from '@/components/ui/ProfileInfo/ProfileInfo';
import { ProfileSettings } from '@/components/ui/ProfileSettings/ProfileSettings';
import { NotificationSettings } from '@/components/ui/ProfileSettings/NotificationSettings';
import { notificationService } from '@/lib/services/notificationService';
import { requirePageUserId } from '@/lib/auth/require-user';
import { userService } from '@/lib/services/userService';
import { PageHeader } from '@/components/layout/PageHeader';
import { Suspense } from 'react';

export default async function ProfilePage() {
  const userId = await requirePageUserId();
  const [user, preferences] = await Promise.all([
    userService.getUserById(userId),
    notificationService.getPreferences(userId),
  ]);
  const notifications = (
    <NotificationSettings
      vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? ''}
      initialPreferences={preferences}
    />
  );
  return (
    <main id="dashboard-main" className="content-page">
      <PageHeader title="Profile" subtitle="Your information and attendance" userId={userId} />
      <div className="content-page-body">
        {user ? (
          <ProfileInfo user={user}>
            <ProfileSettings />
            {notifications}
          </ProfileInfo>
        ) : (
          <>
            <p>Your profile could not be found.</p>
            <ProfileSettings />
            {notifications}
          </>
        )}
        <Suspense fallback={null}>
          <SlackImportNotice userId={userId} />
        </Suspense>
      </div>
    </main>
  );
}
