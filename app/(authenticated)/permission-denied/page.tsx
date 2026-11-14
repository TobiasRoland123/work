import React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button/Button';
import { requirePageUserId } from '@/lib/auth/require-user';

export default async function PermissionDeniedPage() {
  await requirePageUserId();

  return (
    <main id="dashboard-main" className="content-page">
      <PageHeader
        title="You do not have permission"
        subtitle="Your account does not have access to this page."
      />
      <div className="content-page-body space-y-6">
        <p>Contact your workspace admin if you need access.</p>
        <Button ariaLabel="Back to Today" link={{ href: '/today', label: 'Back to Today' }} />
      </div>
    </main>
  );
}
