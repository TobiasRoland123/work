import type { CSSProperties } from 'react';
import { Search } from 'lucide-react';
import { PageHeaderSkeleton } from '@/components/layout/PageHeader';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { WeekLegend } from './WeekLegend';
import './week.css';

const pulse = 'animate-pulse motion-reduce:animate-none';

// Fixed placeholder rows. Each row splits the five weekdays into segments, like real weeks do.
const rows = [
  { name: 'w-28', role: 'w-32', segments: [1, 1, 1, 1, 1] },
  { name: 'w-32', role: 'w-20', segments: [2, 1, 2] },
  { name: 'w-24', role: 'w-28', segments: [1, 1, 1, 1, 1] },
  { name: 'w-36', role: 'w-24', segments: [5] },
  { name: 'w-28', role: null, segments: [1, 1, 3] },
  { name: 'w-20', role: 'w-32', segments: [1, 1, 1, 1, 1] },
  { name: 'w-32', role: 'w-16', segments: [3, 1, 1] },
  { name: 'w-24', role: 'w-24', segments: [1, 4] },
];

// People in the office usually have no detail line; the other groups show where they are.
const panelGroups = [
  { heading: 'w-20', people: ['w-28', 'w-36', 'w-24', 'w-32'], detail: false },
  { heading: 'w-24', people: ['w-32', 'w-20'], detail: true },
];

/** Placeholder for WeekOverview while the week's attendance loads. */
export function WeekOverviewSkeleton() {
  return (
    <div className="week-page" aria-busy="true">
      <span role="status" className="sr-only">
        Loading the week overview…
      </span>
      <PageHeaderSkeleton actions={<Skeleton className="h-10 w-[134px] rounded-[6px]" />} />
      <div className="week-body">
        <main className="week-main" id="dashboard-main">
          <div className="week-toolbar" aria-hidden="true">
            <div className="week-search">
              <Search size={17} />
              <span className="flex-1 text-[14px]">
                <SkeletonText className="w-36" />
              </span>
            </div>
            <div className="week-filters">
              {['w-16', 'w-24', 'w-20'].map((width) => (
                <div key={width} className="flex h-[33.5px] items-center px-3 max-[640px]:flex-1">
                  <Skeleton className={`h-[9px] ${width}`} />
                </div>
              ))}
            </div>
          </div>
          <div
            className="week-board"
            aria-hidden="true"
            // No day is selected yet, so skip the selected-day column highlight.
            style={{ '--from': '0%', '--to': '0%' } as CSSProperties}
          >
            <div className="week-head">
              <div className="week-row">
                <div className="week-person-head">Colleagues</div>
                <div className="week-strip">
                  {Array.from({ length: 5 }, (_, day) => (
                    <div key={day} className="week-day">
                      <span className="week-day-name">
                        <SkeletonText className="w-9" />
                      </span>
                      <span className="week-day-date">
                        <SkeletonText className="w-12" />
                      </span>
                      <span className="week-day-count">
                        <SkeletonText className="w-16" />
                      </span>
                      <span className={`week-day-meter ${pulse}`} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div>
              {rows.map((row, index) => {
                let column = 0;
                return (
                  <div key={index} className="week-row week-person-row">
                    <div className="week-person-cell">
                      <div className="week-person">
                        <Skeleton className="size-8 shrink-0 rounded-full" />
                        <span className="week-person-name">
                          <SkeletonText className={row.name} />
                          {row.role && (
                            <small>
                              <SkeletonText className={row.role} />
                            </small>
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="week-strip">
                      {row.segments.map((span) => {
                        const start = column;
                        column += span;
                        return (
                          <div
                            key={start}
                            className={`week-cell tone ${pulse}`}
                            style={{ gridColumn: `${start + 1} / span ${span}` }}
                          >
                            <SkeletonText className={span > 1 ? 'w-20' : 'w-12'} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <WeekLegend />
        </main>
        <aside className="day-panel" aria-hidden="true">
          <div className="day-panel-inner">
            <header className="day-panel-header">
              <p className="day-panel-eyebrow">
                <SkeletonText className="w-12" />
                <SkeletonText className="w-10" />
              </p>
              <h2>
                <SkeletonText className="w-56" />
              </h2>
              <p className="day-panel-total">
                <strong className="block">
                  <SkeletonText className="w-40" />
                </strong>
              </p>
            </header>
            {panelGroups.map((group, index) => (
              <section key={index} className="day-panel-group">
                <h3>
                  <SkeletonText className={group.heading} />
                </h3>
                <ul>
                  {group.people.map((name, person) => (
                    <li key={person} className="flex items-center gap-[10px] px-[6px] py-[7px]">
                      <Skeleton className="size-7 shrink-0 rounded-full" />
                      <span className="day-panel-person">
                        <SkeletonText className={name} />
                        {group.detail && (
                          <small>
                            <SkeletonText className="w-16" />
                          </small>
                        )}
                      </span>
                      <Skeleton className="size-[9px] shrink-0 rounded-full" />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
