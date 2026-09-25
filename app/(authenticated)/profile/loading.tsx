import { PageHeaderSkeleton } from '@/components/layout/PageHeader';
import { ProfileInfoSkeleton } from '@/components/ui/ProfileInfo/ProfileInfoSkeleton';

export default function ProfileLoading() {
  return (
    <main id="dashboard-main" className="content-page" aria-busy="true">
      <PageHeaderSkeleton title="Profile" subtitle="Your information and attendance" />
      <div className="content-page-body">
        <ProfileInfoSkeleton />
      </div>
    </main>
  );
}
