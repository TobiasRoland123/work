import React from 'react';
import { Search } from 'lucide-react';
import { PageHeaderSkeleton } from '@/components/layout/PageHeader';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';

type RouteLoadingProps = {
  mainId?: string | null;
};

const weekRows = [
  { name: 'w-28', role: 'w-32', segments: [1, 1, 1, 1, 1] },
  { name: 'w-32', role: 'w-20', segments: [2, 1, 2] },
  { name: 'w-24', role: 'w-28', segments: [1, 1, 1, 1, 1] },
  { name: 'w-36', role: 'w-24', segments: [5] },
  { name: 'w-28', role: null, segments: [1, 1, 3] },
  { name: 'w-20', role: 'w-32', segments: [1, 1, 1, 1, 1] },
  { name: 'w-32', role: 'w-16', segments: [3, 1, 1] },
  { name: 'w-24', role: 'w-24', segments: [1, 4] },
];

const contactCards = [
  { name: 'w-36', org: 'w-24', phone: true },
  { name: 'w-32', org: 'w-20', phone: false },
  { name: 'w-40', org: 'w-24', phone: true },
  { name: 'w-28', org: 'w-16', phone: true },
  { name: 'w-36', org: 'w-24', phone: false },
  { name: 'w-32', org: 'w-20', phone: true },
];

export function RolesRouteLoading({ mainId = 'dashboard-main' }: RouteLoadingProps = {}) {
  return (
    <main id={mainId ?? undefined} className="content-page" aria-busy="true">
      <PageHeaderSkeleton title="Roles" subtitle="Manage access for your workspace" />
      <div className="content-page-body space-y-6">
        <p role="status">Loading people…</p>
        <Skeleton className="h-64 w-full" />
      </div>
    </main>
  );
}

export function AiCostRouteLoading({ mainId = 'dashboard-main' }: RouteLoadingProps = {}) {
  return (
    <main id={mainId ?? undefined} className="content-page" aria-busy="true">
      <PageHeaderSkeleton
        title="AI cost"
        subtitle="Reported AI charges for interpreting Slack messages"
      />
      <div className="content-page-body space-y-6">
        <p role="status">Loading AI costs…</p>
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </main>
  );
}

export function EmployeeStatsRouteLoading({ mainId = 'dashboard-main' }: RouteLoadingProps = {}) {
  return (
    <main id={mainId ?? undefined} className="content-page" aria-busy="true">
      <PageHeaderSkeleton
        title="Employee stats"
        subtitle="Where people worked, based on announced and default attendance"
      />
      <div className="content-page-body space-y-6">
        <p role="status">Loading employee stats…</p>
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </main>
  );
}

export function EmployeeDirectoryRouteLoading({
  mainId = 'dashboard-main',
}: RouteLoadingProps = {}) {
  return (
    <main id={mainId ?? undefined} className="content-page" aria-busy="true">
      <PageHeaderSkeleton
        title="Employee stats"
        subtitle="Search an employee to see their own stats"
      />
      <div className="content-page-body space-y-6">
        <p role="status">Loading employees…</p>
        <Skeleton className="h-10 w-44" />
        <Skeleton className="h-64 w-full" />
      </div>
    </main>
  );
}

export function EmployeeProfileRouteLoading({ mainId = 'dashboard-main' }: RouteLoadingProps = {}) {
  return (
    <main id={mainId ?? undefined} className="content-page" aria-busy="true">
      <PageHeaderSkeleton />
      <div className="content-page-body space-y-6">
        <p role="status">Loading employee stats…</p>
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </main>
  );
}

export function MessageQualityRouteLoading({ mainId = 'dashboard-main' }: RouteLoadingProps = {}) {
  return (
    <main id={mainId ?? undefined} className="content-page" aria-busy="true">
      <PageHeaderSkeleton
        title="Message quality"
        subtitle="Accepted Slack messages and saved status outcomes"
      />
      <div className="content-page-body space-y-6">
        <p role="status">Loading message quality…</p>
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </main>
  );
}

export function MyStatsRouteLoading({ mainId = 'dashboard-main' }: RouteLoadingProps = {}) {
  return (
    <main id={mainId ?? undefined} className="content-page" aria-busy="true">
      <PageHeaderSkeleton
        title="Attendance trends"
        subtitle="See how your office routine changes over time."
      />
      <div className="content-page-body space-y-6">
        <p role="status">Loading your attendance trends…</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-36 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-md" />
        <Skeleton className="h-60 rounded-md" />
      </div>
    </main>
  );
}

export function ContactRouteLoading({ mainId = 'dashboard-main' }: RouteLoadingProps = {}) {
  return (
    <main id={mainId ?? undefined} className="content-page" aria-busy="true">
      <PageHeaderSkeleton title="Contact" subtitle="Your colleagues, in one place" />
      <div className="content-page-body space-y-6">
        <span role="status" className="sr-only">
          Loading colleagues…
        </span>
        <div className="mx-auto max-w-[1100px] space-y-6">
          <div className="flex items-end justify-between gap-6">
            <div className="space-y-2">
              <SkeletonText className="w-16" />
              <SkeletonText className="w-56" />
            </div>
            <SkeletonText className="w-16" />
          </div>
          <Skeleton className="h-11 w-full max-w-[420px] rounded-md" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
            {contactCards.map((card, index) => (
              <div
                key={index}
                className="space-y-4 rounded-[10px] border border-(--office-border) bg-(--office-surface) p-5"
              >
                <div className="flex items-center gap-4">
                  <Skeleton className="size-16 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <SkeletonText className={card.name} />
                    <SkeletonText className={card.org} />
                  </div>
                </div>
                <div className="space-y-2">
                  <SkeletonText className="w-48" />
                  {card.phone && <SkeletonText className="w-28" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

export function ProfileRouteLoading({ mainId = 'dashboard-main' }: RouteLoadingProps = {}) {
  return (
    <main id={mainId ?? undefined} className="content-page" aria-busy="true">
      <PageHeaderSkeleton title="Profile" subtitle="Your information and attendance" />
      <div className="content-page-body">
        <span role="status" className="sr-only">
          Loading your profile…
        </span>
        <div className="mx-auto max-w-[920px] space-y-8" aria-hidden="true">
          <div className="flex items-center gap-8 border-b border-(--office-border-soft) pb-8">
            <Skeleton className="size-[136px] shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-3">
              <SkeletonText className="w-32" />
              <SkeletonText className="w-[min(24rem,100%)]" />
            </div>
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((row) => (
              <div
                key={row}
                className="grid grid-cols-[140px_minmax(0,1fr)] gap-4 border-b border-(--office-border-soft) pb-4"
              >
                <SkeletonText className="w-20" />
                <SkeletonText className="w-56" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

export function WeekRouteLoading({ mainId = 'dashboard-main' }: RouteLoadingProps = {}) {
  return (
    <div className="flex min-h-dvh flex-col" aria-busy="true">
      <span role="status" className="sr-only">
        Loading the week overview…
      </span>
      <div className="bg-(--office-surface)">
        <PageHeaderSkeleton
          actions={
            <Skeleton className="h-10 w-[134px] rounded-[6px] max-[640px]:h-[42px] max-[640px]:w-[82px]" />
          }
        />
      </div>
      <div className="grid flex-1 grid-cols-1 min-[1040px]:grid-cols-[minmax(0,1fr)_clamp(300px,24vw,360px)]">
        <main id={mainId ?? undefined} className="min-w-0 space-y-3.5 px-7 pt-5 pb-10 max-[760px]:px-4">
          <div className="flex flex-wrap items-center justify-between gap-3" aria-hidden="true">
            <div className="flex w-[min(320px,100%)] items-center gap-2.5 rounded-[6px] border border-(--office-border) bg-(--office-surface) px-3 py-2 text-(--office-subtle)">
              <Search size={17} />
              <span className="flex-1 text-[14px]">
                <SkeletonText className="w-36" />
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-32 rounded-[8px]" />
              <Skeleton className="h-9 w-36 rounded-[8px] max-[640px]:hidden" />
            </div>
          </div>
          <div
            className="overflow-hidden rounded-[8px] border border-(--office-border) bg-(--office-surface)"
            aria-hidden="true"
          >
            <div className="grid grid-cols-[minmax(160px,220px)_repeat(5,minmax(0,1fr))] border-b border-(--office-border) px-4 py-3">
              <div className="text-[13px] font-medium text-(--office-muted)">Colleagues</div>
              {[0, 1, 2, 3, 4].map((day) => (
                <div key={day} className="space-y-1.5 px-2">
                  <SkeletonText className="w-12" />
                  <SkeletonText className="w-16" />
                </div>
              ))}
            </div>
            {weekRows.map((row, index) => (
              <div
                key={index}
                className="grid grid-cols-[minmax(160px,220px)_repeat(5,minmax(0,1fr))] items-center border-b border-(--office-border-soft) px-4 py-2.5 last:border-b-0"
              >
                <div className="flex items-center gap-2.5 pr-3">
                  <Skeleton className="size-8 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <SkeletonText className={row.name} />
                    {row.role && <SkeletonText className={row.role} />}
                  </div>
                </div>
                {row.segments.map((span, segIndex) => (
                  <div
                    key={segIndex}
                    className="px-1"
                    style={{ gridColumn: `span ${span} / span ${span}` }}
                  >
                    <Skeleton className="h-10 w-full rounded-[6px]" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </main>
        <aside
          className="hidden border-l border-(--office-border) bg-(--office-surface) p-6 min-[1040px]:block"
          aria-hidden="true"
        >
          <div className="space-y-4">
            <SkeletonText className="w-24" />
            <SkeletonText className="w-48" />
            <SkeletonText className="w-36" />
            <div className="space-y-3 pt-4">
              {['w-28', 'w-36', 'w-24', 'w-32', 'w-20'].map((width, index) => (
                <div key={index} className="flex items-center gap-2.5">
                  <Skeleton className="size-8 shrink-0 rounded-full" />
                  <SkeletonText className={width} />
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
  return pathname || '/';
}

/** Immediate route loading view shown in AppShell while waiting for a server RSC transition. */
export function RouteLoadingFallback({ pathname }: { pathname: string }) {
  const normalized = normalizePathname(pathname);
  if (normalized === '/today') return <WeekRouteLoading mainId={null} />;
  if (normalized === '/contact') return <ContactRouteLoading mainId={null} />;
  if (normalized === '/profile') return <ProfileRouteLoading mainId={null} />;
  if (normalized === '/my-stats') return <MyStatsRouteLoading mainId={null} />;
  if (normalized === '/message-quality') return <MessageQualityRouteLoading mainId={null} />;
  if (normalized === '/ai-cost') return <AiCostRouteLoading mainId={null} />;
  if (normalized === '/employee-stats') return <EmployeeStatsRouteLoading mainId={null} />;
  if (normalized === '/employee-stats/people') {
    return <EmployeeDirectoryRouteLoading mainId={null} />;
  }
  if (normalized.startsWith('/employee-stats/people/')) {
    return <EmployeeProfileRouteLoading mainId={null} />;
  }
  if (normalized === '/admin/roles' || normalized === '/employee-stats/access') {
    return <RolesRouteLoading mainId={null} />;
  }
  return null;
}
