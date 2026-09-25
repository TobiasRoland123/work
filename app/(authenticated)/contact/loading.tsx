import { PageHeaderSkeleton } from '@/components/layout/PageHeader';
import { ContactDirectorySkeleton } from '@/components/directory/ContactDirectorySkeleton';

export default function ContactLoading() {
  return (
    <main id="dashboard-main" className="content-page" aria-busy="true">
      <PageHeaderSkeleton title="Contact" subtitle="Your colleagues, in one place" />
      <div className="content-page-body">
        <ContactDirectorySkeleton />
      </div>
    </main>
  );
}
