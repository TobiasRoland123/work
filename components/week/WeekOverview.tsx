'use client';

import { useState, type CSSProperties } from 'react';
import Link from 'next/link';
import * as Dialog from '@radix-ui/react-dialog';
import {
  CalendarPlus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  PanelRightClose,
  PanelRightOpen,
  Search,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { DayPresence, UserWithExtras } from '@/db/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusDialog } from '@/components/layout/StatusDialog';
import { AIIndicator } from '@/components/ui/Status/AIIndicator';
import { ProfileListItem } from '@/components/ui/ProfileListItem/ProfileListItem';
import { StatusEmoji } from '@/components/ui/Status/StatusEmoji';
import { deleteStatusByIdAction } from '@/app/actions/statusActions';
import type { UpcomingStatus } from '@/lib/status/plan';
import { addDays, formatDay, isoWeekNumber, shiftWorkWeek } from '@/lib/status/week';
import {
  dayAnnouncement,
  dayNote,
  groupAttendance,
  isAssumed,
  personName,
  presenceOf,
  segmentNote,
  segmentWeek,
  type Segment,
} from './presence';
import { Avatar } from './Avatar';
import { rememberWeekPanel } from './panelPreference';
import { PinnedColleagues } from './PinnedColleagues';
import { StatusCorrection } from './StatusCorrection';
import './week.css';

const shortDay = (day: string) =>
  formatDay(day, { weekday: 'short', day: 'numeric', month: 'short' });

function weekTitle(weekStart: string, currentWeekStart: string, includesToday: boolean) {
  const offset = Math.round(
    (Date.parse(weekStart) - Date.parse(currentWeekStart)) / (7 * 86_400_000)
  );
  if (offset === 0) return includesToday ? 'This week' : 'Coming week';
  if (offset === 1) return 'Next week';
  if (offset === -1) return 'Last week';
  return `Week ${isoWeekNumber(weekStart)}`;
}

function weekRange(days: readonly string[]) {
  const first = days[0];
  const last = days[days.length - 1];
  const sameMonth = first.slice(0, 7) === last.slice(0, 7);
  return `${formatDay(first, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' })}–${formatDay(last, { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

function WeekCell({
  segment,
  days,
  today,
  onPlan,
  hideInOffice = false,
}: {
  segment: Segment;
  days: readonly string[];
  today: string;
  /** Present in the signed-in person's row; receives the segment's days from today on. */
  onPlan?: (days: string[]) => void;
  hideInOffice?: boolean;
}) {
  const hiddenOffice = hideInOffice && segment.status?.status === 'IN_OFFICE';
  const { label, tone } = hiddenOffice
    ? { label: 'No exception', tone: 'none' }
    : presenceOf(segment.status);
  const assumed = !hiddenOffice && isAssumed(segment.status);
  const note = hiddenOffice
    ? null
    : days.length === 1
      ? dayNote(segment.status)
      : segmentNote(segment, days);
  const lastDay = days[segment.start + segment.span - 1];
  const title = [
    label,
    note,
    assumed && 'assumed, nothing announced',
    !hiddenOffice && segment.status?.sourceMessageKey && 'AI-assisted',
  ]
    .filter(Boolean)
    .join(' · ');
  const plannable = onPlan
    ? days.slice(segment.start, segment.start + segment.span).filter((day) => day >= today)
    : [];
  const content = hiddenOffice ? (
    <span className="sr-only">No exception</span>
  ) : (
    <>
      <strong>
        <StatusEmoji
          status={segment.status?.status ?? null}
          emoji={segment.status?.emoji}
          details={segment.status?.details}
        />
        {label}
      </strong>
      {note && <small>{note}</small>}
      {assumed && <span className="sr-only"> (assumed)</span>}
    </>
  );
  return (
    <div
      role="cell"
      aria-colspan={segment.span > 1 ? segment.span : undefined}
      className="week-cell tone"
      data-tone={tone}
      data-ai-assisted={(!hiddenOffice && Boolean(segment.status?.sourceMessageKey)) || undefined}
      data-assumed={assumed || undefined}
      data-past={lastDay < today || undefined}
      data-plannable={plannable.length > 0 || undefined}
      style={{ gridColumn: `${segment.start + 1} / span ${segment.span}` }}
      title={title}
    >
      {onPlan && plannable.length ? (
        <button
          className="week-cell-plan"
          onClick={() => onPlan(plannable)}
          aria-label={`Plan ${plannable.map(shortDay).join(', ')}. Currently: ${title}`}
        >
          {content}
          <Pencil size={13} className="week-cell-plan-icon" aria-hidden="true" />
        </button>
      ) : (
        content
      )}
      {!hiddenOffice && (
        <AIIndicator sourceMessageKey={segment.status?.sourceMessageKey} position="corner" />
      )}
    </div>
  );
}

function UpcomingPlans({
  plans,
  onRemove,
}: {
  plans: UpcomingStatus[];
  onRemove: (id: number) => void;
}) {
  if (!plans.length) return <p className="person-sheet-empty">Nothing announced from today on.</p>;
  return (
    <ul className="person-sheet-plans">
      {plans.map((plan) => {
        const { label, tone } = presenceOf(plan);
        const note = dayNote(plan);
        return (
          <li key={plan.id}>
            <span className="person-sheet-plan-when">
              {plan.firstDay === plan.lastDay
                ? shortDay(plan.firstDay)
                : `${shortDay(plan.firstDay)} – ${shortDay(plan.lastDay)}`}
            </span>
            <span className="person-sheet-status">
              <span
                className="week-chip tone"
                data-tone={tone}
                data-ai-assisted={Boolean(plan.sourceMessageKey) || undefined}
              >
                <StatusEmoji status={plan.status} emoji={plan.emoji} details={plan.details} />
                {label}
                <AIIndicator sourceMessageKey={plan.sourceMessageKey} position="corner" />
              </span>
              {note && <small>{note}</small>}
            </span>
            {plan.sourceMessageKey ? (
              <a
                className="person-sheet-plan-action"
                href={`/api/slack/message?key=${encodeURIComponent(plan.sourceMessageKey)}`}
                target="_blank"
                rel="noreferrer"
              >
                Edit in Slack
              </a>
            ) : (
              <button
                className="person-sheet-plan-action"
                onClick={() => onRemove(plan.id)}
                aria-label={`Remove ${label} on ${shortDay(plan.firstDay)}`}
              >
                Remove
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function PersonSheet({
  person,
  days,
  title,
  onClose,
  plans,
  onPlan,
  onRemove,
  onCorrected,
}: {
  person: UserWithExtras | undefined;
  days: readonly string[];
  title: string;
  onClose: () => void;
  /** Set only for the signed-in person. */
  plans?: UpcomingStatus[];
  onPlan?: () => void;
  onRemove?: (id: number) => void;
  /** Set only for the signed-in person, who may correct their own imported statuses. */
  onCorrected?: () => void;
}) {
  return (
    <Dialog.Root open={Boolean(person)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="office-dialog-overlay" />
        <Dialog.Content className="person-sheet">
          {person && (
            <>
              <Dialog.Title className="sr-only">{personName(person)}</Dialog.Title>
              <Dialog.Description className="sr-only">
                Contact details and attendance for {title.toLocaleLowerCase()}
              </Dialog.Description>
              <Dialog.Close className="person-sheet-close" aria-label="Close colleague details">
                <X size={20} />
              </Dialog.Close>
              <section>
                <h3 className="person-sheet-heading">Right now</h3>
                <ProfileListItem user={person} showStatus />
              </section>
              <section>
                <h3 className="person-sheet-heading">{title}</h3>
                <ol className="person-sheet-week">
                  {(person.week ?? days.map((date): DayPresence => ({ date, status: null }))).map(
                    (day) => {
                      const { date } = day;
                      const status = dayAnnouncement(day);
                      const { label, tone } = presenceOf(status);
                      const note = dayNote(status);
                      return (
                        <li key={date}>
                          <span className="person-sheet-day">
                            {formatDay(date, { weekday: 'short' })}
                            <small>{formatDay(date, { day: 'numeric', month: 'short' })}</small>
                          </span>
                          <span className="person-sheet-status">
                            <span
                              className="week-chip tone"
                              data-tone={tone}
                              data-ai-assisted={Boolean(status?.sourceMessageKey) || undefined}
                              data-assumed={isAssumed(status) || undefined}
                            >
                              <StatusEmoji
                                status={status?.status ?? null}
                                emoji={status?.emoji}
                                details={status?.details}
                              />
                              {label}
                              {isAssumed(status) && ' (assumed)'}
                              <AIIndicator
                                sourceMessageKey={status?.sourceMessageKey}
                                position="corner"
                              />
                            </span>
                            {note && <small>{note}</small>}
                            {status?.sourceMessageKey && (
                              <a
                                href={`/api/slack/message?key=${encodeURIComponent(status.sourceMessageKey)}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                View Slack message
                              </a>
                            )}
                            {status?.sourceMessageKey && onCorrected && (
                              <StatusCorrection
                                key={`${status.id}:${status.status}`}
                                status={status}
                                date={date}
                                onSaved={onCorrected}
                              />
                            )}
                          </span>
                        </li>
                      );
                    }
                  )}
                </ol>
              </section>
              {plans && onRemove && (
                <section>
                  <div className="person-sheet-heading-row">
                    <h3 className="person-sheet-heading">Your upcoming announcements</h3>
                    {onPlan && (
                      <button className="person-sheet-plan-button" onClick={onPlan}>
                        <CalendarPlus size={16} aria-hidden="true" />
                        Plan days
                      </button>
                    )}
                  </div>
                  <UpcomingPlans plans={plans} onRemove={onRemove} />
                  <p className="person-sheet-hint">
                    The newest announcement for a day wins. Removing one brings back what was there
                    before.
                  </p>
                </section>
              )}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Share of colleagues in the office, 0–1. The meter shifts from red (0) to green (1).
const share = (inOffice: number, total: number) => (total ? inOffice / total : 0);

export function WeekOverview({
  profiles,
  userId,
  days,
  today,
  weekStart,
  currentWeekStart,
  arrival,
  syncError,
  plans,
  pinnedIds,
  onPinChange,
  onStatusSaved,
  initialPanelOpen = true,
}: {
  profiles: UserWithExtras[];
  userId: string;
  days: string[];
  today: string;
  weekStart: string;
  currentWeekStart: string;
  arrival: string | null;
  syncError: boolean;
  plans: UpcomingStatus[];
  /** Colleagues the signed-in person pinned, in the order they were pinned. */
  pinnedIds: string[];
  onPinChange: (colleagueUserId: string, pinned: boolean) => void;
  onStatusSaved: () => void;
  /** Whether the side panel starts open; the visitor's last choice, read on the server. */
  initialPanelOpen?: boolean;
}) {
  const todayOnly = days.length === 1;
  const [panelOpen, setPanelOpen] = useState(initialPanelOpen);
  const [query, setQuery] = useState('');
  const [selectedDay, setSelectedDay] = useState(days.includes(today) ? today : days[0]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [planDays, setPlanDays] = useState<string[] | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());

  // A triple click applies the clicked group's toggled state to every group.
  const toggleGroup = (key: string, clicks: number) => {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (clicks === 3) {
        const collapse = !current.has(key);
        for (const group of groups) {
          if (collapse) next.add(group.key);
          else next.delete(group.key);
        }
      } else if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const togglePanel = () => {
    const next = !panelOpen;
    setPanelOpen(next);
    rememberWeekPanel(next);
  };

  const plan = (planned: string[]) => {
    setOpenId(null);
    setPlanDays(planned);
  };
  async function removePlan(id: number) {
    try {
      await deleteStatusByIdAction(id);
      toast('Announcement removed');
      onStatusSaved();
    } catch {
      toast('Could not remove the announcement 🚫');
    }
  }

  const dayIndex = Math.max(0, days.indexOf(selectedDay));
  const title = todayOnly
    ? days[0] === today
      ? 'Today'
      : formatDay(days[0], { weekday: 'long' })
    : weekTitle(weekStart, currentWeekStart, days.includes(today));
  const subtitle = todayOnly
    ? formatDay(days[0], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : `Week ${isoWeekNumber(weekStart)} · ${weekRange(days)}`;
  const statusOn = (person: UserWithExtras, index: number) =>
    dayAnnouncement(person.week?.find((day) => day.date === days[index]));
  const inOfficeOn = (person: UserWithExtras, index: number) =>
    person.week?.find((day) => day.date === days[index])?.status?.status === 'IN_OFFICE';
  const hasExceptionOn = (person: UserWithExtras, index: number) => {
    const status = statusOn(person, index);
    return status !== null && status.status !== 'IN_OFFICE';
  };

  // Keep the directory order, with the signed-in person pinned first.
  const people = [...profiles].sort(
    (a, b) => Number(b.userId === userId) - Number(a.userId === userId)
  );
  const officeCounts = days.map(
    (_, index) => people.filter((person) => inOfficeOn(person, index)).length
  );
  const needle = query.trim().toLocaleLowerCase();
  const visible = people.filter((person) => {
    const searchable = [personName(person), ...(person.organisationRoles ?? [])]
      .join(' ')
      .toLocaleLowerCase();
    return searchable.includes(needle) && days.some((_, index) => hasExceptionOn(person, index));
  });
  const groups = groupAttendance(visible, days[dayIndex]);
  const colleagues = people.filter((person) => person.userId !== userId);

  return (
    <div className="week-page">
      <PageHeader
        title={title}
        subtitle={subtitle}
        userId={userId}
        statusWeekStart={weekStart}
        onStatusSaved={onStatusSaved}
        actions={
          <nav className="week-nav" aria-label={todayOnly ? 'Choose day' : 'Choose week'}>
            <Link
              href={
                todayOnly
                  ? `/today?day=${addDays(days[0], -1)}`
                  : `/today?week=${shiftWorkWeek(weekStart, -1)}`
              }
              aria-label={todayOnly ? 'Previous day' : 'Previous week'}
            >
              <ChevronLeft size={18} />
            </Link>
            <Link
              href="/today"
              aria-current={todayOnly && days[0] === today ? 'page' : undefined}
              className="week-nav-current"
            >
              Today
            </Link>
            <Link
              href={
                todayOnly
                  ? `/today?day=${addDays(days[0], 1)}`
                  : `/today?week=${shiftWorkWeek(weekStart, 1)}`
              }
              aria-label={todayOnly ? 'Next day' : 'Next week'}
            >
              <ChevronRight size={18} />
            </Link>
          </nav>
        }
      />
      <div className="week-body" data-panel={panelOpen ? 'open' : 'closed'}>
        <main className="week-main" id="dashboard-main">
          <div className="week-toolbar">
            <label className="week-search">
              <Search size={17} aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a colleague..."
                aria-label="Find a colleague"
              />
              {query && (
                <button onClick={() => setQuery('')} aria-label="Clear search">
                  <X size={15} />
                </button>
              )}
            </label>
            <div className="week-toolbar-actions">
              <div className="week-filters" role="group" aria-label="Attendance view">
                <Link href="/today" aria-current={todayOnly ? 'page' : undefined}>
                  Today
                </Link>
                <Link
                  href={`/today?week=${todayOnly ? currentWeekStart : weekStart}`}
                  aria-current={todayOnly ? undefined : 'page'}
                >
                  Week
                </Link>
              </div>
              <button
                type="button"
                className="week-panel-toggle"
                aria-expanded={panelOpen}
                aria-controls={panelOpen ? 'day-panel' : undefined}
                aria-label="Side panel"
                title={panelOpen ? 'Hide side panel' : 'Show side panel'}
                onClick={togglePanel}
              >
                {panelOpen ? (
                  <PanelRightClose size={18} aria-hidden="true" />
                ) : (
                  <PanelRightOpen size={18} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
          {!todayOnly && (
            <p className="week-grouping-note" id="week-grouping-note">
              Grouped by{' '}
              {formatDay(days[dayIndex], { weekday: 'long', day: 'numeric', month: 'long' })}.{' '}
              Showing colleagues with an attendance exception this week.
            </p>
          )}
          <div
            className="week-board"
            role="table"
            aria-label={`Attendance, ${subtitle}`}
            aria-describedby={todayOnly ? undefined : 'week-grouping-note'}
            style={{ '--selected': dayIndex, '--days': days.length } as CSSProperties}
          >
            <div role="rowgroup" className="week-head">
              <div role="row" className="week-row">
                <div role="columnheader" className="week-person-head">
                  Colleagues <span>{visible.length}</span>
                </div>
                <div className="week-strip">
                  {days.map((day, index) => (
                    <div
                      role="columnheader"
                      key={day}
                      aria-current={day === today ? 'date' : undefined}
                    >
                      <button
                        className="week-day"
                        aria-pressed={day === selectedDay}
                        data-past={day < today || undefined}
                        onClick={() => setSelectedDay(day)}
                      >
                        <span className="week-day-name">
                          {formatDay(day, { weekday: 'short' })}
                          <span className="week-day-date">
                            {formatDay(day, { day: 'numeric' })}
                          </span>
                          {day === today && <em>Today</em>}
                        </span>
                        <span className="week-day-count">
                          <strong>{people.length - officeCounts[index]}</strong> out of office
                        </span>
                        <span className="week-day-meter" aria-hidden="true">
                          <i
                            style={{
                              width: `${share(officeCounts[index], people.length) * 100}%`,
                              background: `hsl(${Math.round(share(officeCounts[index], people.length) * 120)} 55% 40%)`,
                            }}
                          />
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {groups.map(({ key, label, tone, members }) => (
              <div role="rowgroup" className="week-status-group" aria-label={label} key={key}>
                <div role="row" className="week-status-heading">
                  <div role="cell" aria-colspan={days.length + 1}>
                    <h2>
                      <button
                        type="button"
                        className="week-group-toggle"
                        aria-expanded={!collapsedGroups.has(key)}
                        onClick={(event) => toggleGroup(key, event.detail)}
                      >
                        <ChevronDown size={16} className="group-chevron" aria-hidden="true" />
                        <i className="tone-dot tone" data-tone={tone} aria-hidden="true" />
                        {label}{' '}
                        <span>
                          {members.length} {collapsedGroups.has(key) ? 'hidden' : 'shown'}
                        </span>
                      </button>
                    </h2>
                  </div>
                </div>
                <div
                  role="none"
                  className="group-collapse"
                  data-collapsed={collapsedGroups.has(key) || undefined}
                >
                  <div role="none">
                    {members.map((person) => (
                      <div role="row" className="week-row week-person-row" key={person.userId}>
                        <div role="rowheader" className="week-person-cell">
                          <button className="week-person" onClick={() => setOpenId(person.userId)}>
                            <Avatar person={person} />
                            <span className="week-person-name">
                              <span className="week-person-name-line">
                                <span className="week-person-name-text">{personName(person)}</span>
                                {person.userId === userId && <em>You</em>}
                              </span>
                              {person.userId === userId ? (
                                <small>Click a day to plan it</small>
                              ) : (
                                person.organisationRoles?.[0] && (
                                  <small>{person.organisationRoles[0]}</small>
                                )
                              )}
                            </span>
                          </button>
                        </div>
                        <div className="week-strip">
                          {segmentWeek(
                            days.map(
                              (date, index): DayPresence => ({
                                date,
                                status: statusOn(person, index),
                              })
                            )
                          ).map((segment) => (
                            <WeekCell
                              key={segment.start}
                              segment={segment}
                              days={days}
                              today={today}
                              hideInOffice
                              onPlan={person.userId === userId ? plan : undefined}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {!visible.length && (
              <p className="week-empty">
                {!people.length
                  ? 'No colleagues to show yet.'
                  : needle
                    ? 'No colleagues match your search.'
                    : 'No attendance exceptions to show.'}
              </p>
            )}
          </div>
        </main>
        {panelOpen && (
          <aside
            id="day-panel"
            className="day-panel"
            aria-label={`Who is in the office on ${formatDay(selectedDay, { weekday: 'long' })}`}
          >
            <div className="day-panel-inner">
              <header className="day-panel-header">
                <p className="day-panel-eyebrow">
                  {selectedDay === today ? 'Today' : selectedDay < today ? 'Earlier' : 'Planned'}
                  <span className="day-panel-sync" data-error={syncError || undefined}>
                    <i aria-hidden="true" />
                    {syncError ? 'Reconnecting...' : 'Live'}
                  </span>
                </p>
                <h2>
                  {formatDay(selectedDay, { weekday: 'long', day: 'numeric', month: 'long' })}
                </h2>
                <p className="day-panel-total">
                  <strong>{officeCounts[dayIndex]}</strong> of {people.length} in the office
                </p>
              </header>
              {arrival && selectedDay === today && (
                <p className="day-panel-arrival" role="status">
                  <i aria-hidden="true" />
                  {arrival}
                </p>
              )}
              <PinnedColleagues
                people={colleagues}
                pinnedIds={pinnedIds}
                day={days[dayIndex]}
                onOpen={setOpenId}
                onPinChange={onPinChange}
              />
            </div>
          </aside>
        )}
      </div>
      <PersonSheet
        person={profiles.find((person) => person.userId === openId)}
        days={days}
        title={title}
        onClose={() => setOpenId(null)}
        plans={openId === userId ? plans : undefined}
        onPlan={() => plan(days.filter((day) => day >= today).slice(0, 1))}
        onRemove={removePlan}
        onCorrected={openId === userId ? onStatusSaved : undefined}
      />
      <StatusDialog
        userId={userId}
        open={planDays !== null}
        onOpenChange={(open) => !open && setPlanDays(null)}
        initialDays={planDays ?? undefined}
        weekStart={weekStart}
        onSaved={onStatusSaved}
      />
    </div>
  );
}
