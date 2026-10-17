'use client';

import { useState, type CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Baby,
  Briefcase,
  Building2,
  CalendarPlus,
  CalendarOff,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Clock,
  House,
  LogOut,
  Pencil,
  Plane,
  Plus,
  Search,
  StickyNote,
  Sun,
  Thermometer,
  X,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import type { DayPresence, Status, UserWithExtras } from '@/db/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusDialog } from '@/components/layout/StatusDialog';
import type { StatusType } from '@/components/ui/Status/Status';
import { ProfileListItem } from '@/components/ui/ProfileListItem/ProfileListItem';
import { deleteStatusByIdAction } from '@/app/actions/statusActions';
import { getSlackImageUrl } from '@/lib/slack/image';
import type { UpcomingStatus } from '@/lib/status/plan';
import { addDays, formatDay, isoWeekNumber, shiftWorkWeek } from '@/lib/status/week';
import {
  dayNote,
  groupAttendance,
  groupExceptions,
  initials,
  isAssumed,
  personName,
  presenceOf,
  segmentNote,
  segmentWeek,
  timeNote,
  type ExceptionGroupKey,
  type Segment,
} from './presence';
import { WeekLegend } from './WeekLegend';
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

function Avatar({ person, size = 32 }: { person: UserWithExtras; size?: number }) {
  const picture = getSlackImageUrl(person.profilePicture);
  return (
    <span className="week-avatar" style={{ width: size, height: size }} aria-hidden="true">
      {picture ? (
        <Image src={picture} alt="" width={size} height={size} unoptimized />
      ) : (
        initials(person)
      )}
    </span>
  );
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
  const title = [label, note, assumed && 'assumed, nothing announced'].filter(Boolean).join(' · ');
  const plannable = onPlan
    ? days.slice(segment.start, segment.start + segment.span).filter((day) => day >= today)
    : [];
  const content = hiddenOffice ? (
    <span className="sr-only">No exception</span>
  ) : (
    <>
      <strong>{label}</strong>
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
    </div>
  );
}

const statusIcons: Record<StatusType, LucideIcon> = {
  IN_OFFICE: Building2,
  IN_LATE: Clock,
  LEAVING_EARLY: LogOut,
  FROM_HOME: House,
  AT_CLIENT: Briefcase,
  SICK: Thermometer,
  CHILD_SICK: Baby,
  VACATION: Sun,
  ON_LEAVE: CalendarOff,
  AWAY: Plane,
};

function StatusIcon({ status, size = 12 }: { status: Status | null; size?: number }) {
  const Icon = !status ? CircleDashed : status.status ? statusIcons[status.status] : StickyNote;
  return <Icon size={size} aria-hidden="true" />;
}

/** True when a day carries something other than being in the office. */
const isException = (status: Status | null): status is Status =>
  status !== null && status.status !== 'IN_OFFICE';

function DayListRow({
  person,
  days,
  week,
  dayIndex,
  detail,
  onOpen,
}: {
  person: UserWithExtras;
  days: readonly string[];
  /** The person's status on each of the visible days. */
  week: (Status | null)[];
  dayIndex: number;
  /** Replaces the selected day's status, for rows without an exception that day. */
  detail?: string;
  onOpen: () => void;
}) {
  const status = week[dayIndex];
  const { label, tone } = presenceOf(status);
  const segment = segmentWeek(days.map((date, index) => ({ date, status: week[index] }))).find(
    ({ start, span }) => dayIndex >= start && dayIndex < start + span
  );
  const note = detail ?? (segment ? segmentNote(segment, days) : null);
  return (
    <li>
      <button className="week-list-row" onClick={onOpen}>
        <Avatar person={person} />
        <span className="week-list-text">
          <span className="week-list-name">{personName(person)}</span>
          <span className="week-list-status">
            {detail === undefined && (
              <span className="week-chip tone" data-tone={tone}>
                <StatusIcon status={status} />
                {label}
              </span>
            )}
            {note && <small>{note}</small>}
          </span>
        </span>
        {days.length > 1 && (
          <span className="week-ticks" aria-hidden="true">
            {week.map((day, index) => (
              <i
                key={days[index]}
                className="tone"
                data-tone={isException(day) ? presenceOf(day).tone : 'none'}
                data-selected={index === dayIndex || undefined}
              />
            ))}
          </span>
        )}
      </button>
    </li>
  );
}

function YourWeek({
  person,
  days,
  week,
  dayIndex,
  today,
  title,
  onPlan,
  onOpen,
}: {
  person: UserWithExtras;
  days: readonly string[];
  week: (Status | null)[];
  dayIndex: number;
  today: string;
  title: string;
  onPlan: (days: string[]) => void;
  onOpen: () => void;
}) {
  return (
    <section className="week-mine" aria-labelledby="week-mine-title">
      <div className="week-mine-header">
        <Avatar person={person} size={24} />
        <h2 id="week-mine-title">{title}</h2>
        <button className="week-mine-link" onClick={onOpen}>
          Announcements
        </button>
      </div>
      <ol className="week-mine-days" style={{ '--days': days.length } as CSSProperties}>
        {days.map((day, index) => {
          const status = week[index];
          const exception = isException(status);
          const { label, tone } = exception ? presenceOf(status) : { label: '', tone: 'none' };
          const current = exception ? [label, dayNote(status)].filter(Boolean).join(' · ') : null;
          const props = {
            className: 'week-mine-day tone',
            'data-tone': tone,
            'data-empty': !exception || undefined,
            'data-selected': index === dayIndex || undefined,
          };
          const name = <strong>{formatDay(day, { weekday: 'short' })}</strong>;
          return (
            <li key={day}>
              {day >= today ? (
                <button
                  {...props}
                  onClick={() => onPlan([day])}
                  aria-label={`Plan ${shortDay(day)}. Currently: ${current ?? 'no exception'}`}
                >
                  {name}
                  {exception ? (
                    <StatusIcon status={status} size={15} />
                  ) : (
                    <Plus size={15} aria-hidden="true" />
                  )}
                  <span>{exception ? (timeNote(status) ?? label) : 'Plan'}</span>
                </button>
              ) : (
                <span {...props} data-past>
                  {name}
                  {exception && <StatusIcon status={status} size={15} />}
                  <span aria-hidden="true">{exception ? (timeNote(status) ?? label) : '–'}</span>
                  <span className="sr-only">{current ?? 'No exception'}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
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
              <span className="week-chip tone" data-tone={tone}>
                {label}
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
                    ({ date, status }) => {
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
                              data-assumed={isAssumed(status) || undefined}
                            >
                              {label}
                              {isAssumed(status) && ' (assumed)'}
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
  onStatusSaved,
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
  onStatusSaved: () => void;
}) {
  const todayOnly = days.length === 1;
  const [query, setQuery] = useState('');
  const [selectedDay, setSelectedDay] = useState(days.includes(today) ? today : days[0]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [planDays, setPlanDays] = useState<string[] | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const [listFilter, setListFilter] = useState<'all' | ExceptionGroupKey>('all');
  const [showInOffice, setShowInOffice] = useState(false);

  // A triple click applies the clicked group's toggled state to every group in that list.
  const toggleGroup = (list: 'table' | 'sidebar', key: string, clicks: number) => {
    const id = `${list}-${key}`;
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (clicks === 3) {
        const collapse = !current.has(id);
        for (const group of groups) {
          if (collapse) next.add(`${list}-${group.key}`);
          else next.delete(`${list}-${group.key}`);
        }
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
    person.week?.find((day) => day.date === days[index])?.status ?? null;
  const inOfficeOn = (person: UserWithExtras, index: number) =>
    statusOn(person, index)?.status === 'IN_OFFICE';
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
  const emptyMessage = !people.length
    ? 'No colleagues to show yet.'
    : needle
      ? 'No colleagues match your search.'
      : 'No attendance exceptions to show.';

  // The phone layout lists one day: the signed-in person gets their own card above it.
  const me = people.find((person) => person.userId === userId);
  const colleagues = visible.filter((person) => person.userId !== userId);
  const dayList = groupExceptions(colleagues, days[dayIndex]);
  const weekOf = (person: UserWithExtras) => days.map((_, index) => statusOn(person, index));
  const listed = dayList.groups.reduce((total, group) => total + group.members.length, 0);
  const weekday = formatDay(days[dayIndex], { weekday: 'long' });
  const shownGroups = dayList.groups.filter((group) =>
    listFilter === 'all' ? group.members.length > 0 : group.key === listFilter
  );
  const nextException = (person: UserWithExtras) => {
    const later = days.findIndex((_, index) => index > dayIndex && hasExceptionOn(person, index));
    const index = later >= 0 ? later : days.findIndex((_, i) => hasExceptionOn(person, i));
    return `${later >= 0 ? 'Next' : 'Earlier'}: ${formatDay(days[index], { weekday: 'long' })} · ${presenceOf(statusOn(person, index)).label}`;
  };

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
      <div className="week-body">
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
                          {day === today && <em>Today</em>}
                        </span>
                        <span className="week-day-date">
                          {formatDay(day, { day: 'numeric', month: 'short' })}
                        </span>
                        <span className="week-day-count">
                          <strong>{officeCounts[index]}</strong> in office
                        </span>
                        <span className="week-day-meter" aria-hidden="true">
                          <i
                            style={{
                              width: `${people.length ? (officeCounts[index] / people.length) * 100 : 0}%`,
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
                        aria-expanded={!collapsedGroups.has(`table-${key}`)}
                        onClick={(event) => toggleGroup('table', key, event.detail)}
                      >
                        <ChevronDown size={16} className="group-chevron" aria-hidden="true" />
                        <i className="tone-dot tone" data-tone={tone} aria-hidden="true" />
                        {label}{' '}
                        <span>
                          {members.length}{' '}
                          {collapsedGroups.has(`table-${key}`) ? 'hidden' : 'shown'}
                        </span>
                      </button>
                    </h2>
                  </div>
                </div>
                <div
                  role="none"
                  className="group-collapse"
                  data-collapsed={collapsedGroups.has(`table-${key}`) || undefined}
                >
                  <div role="none">
                    {members.map((person) => (
                      <div role="row" className="week-row week-person-row" key={person.userId}>
                        <div role="rowheader" className="week-person-cell">
                          <button className="week-person" onClick={() => setOpenId(person.userId)}>
                            <Avatar person={person} />
                            <span className="week-person-name">
                              <span>
                                {personName(person)}
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
            {!visible.length && <p className="week-empty">{emptyMessage}</p>}
          </div>
          <section
            className="week-list"
            aria-label={`Exceptions on ${formatDay(days[dayIndex], { weekday: 'long', day: 'numeric', month: 'long' })}`}
          >
            <div className="week-list-filters" role="group" aria-label="Show">
              {[
                {
                  key: 'all' as const,
                  label: 'All',
                  tone: null,
                  count: listed + dayList.other.length,
                },
                ...dayList.groups.map(({ key, label, tone, members }) => ({
                  key,
                  label: key === 'elsewhere' ? 'Elsewhere' : label,
                  tone,
                  count: members.length,
                })),
              ].map(({ key, label, tone, count }) => (
                <button
                  key={key}
                  aria-pressed={listFilter === key}
                  onClick={() => setListFilter(key)}
                >
                  {tone && <i className="tone-dot tone" data-tone={tone} aria-hidden="true" />}
                  {label} <span>{count}</span>
                </button>
              ))}
            </div>
            {!todayOnly && me && (
              <YourWeek
                person={me}
                days={days}
                week={weekOf(me)}
                dayIndex={dayIndex}
                today={today}
                title="Your week"
                onPlan={plan}
                onOpen={() => setOpenId(userId)}
              />
            )}
            {shownGroups.map(({ key, label, tone, members }) => (
              <section className="week-list-group" aria-label={label} key={key}>
                <h2>
                  <i className="tone-dot tone" data-tone={tone} aria-hidden="true" />
                  {label} <span>{members.length}</span>
                </h2>
                {members.length ? (
                  <ul className="week-list-card">
                    {members.map((person) => (
                      <DayListRow
                        key={person.userId}
                        person={person}
                        days={days}
                        week={weekOf(person)}
                        dayIndex={dayIndex}
                        onOpen={() => setOpenId(person.userId)}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="week-empty">Nobody on {weekday}.</p>
                )}
              </section>
            ))}
            {listFilter === 'all' && dayList.other.length > 0 && (
              <section className="week-list-group" aria-label="Other">
                <h2>
                  <i className="tone-dot tone" data-tone="note" aria-hidden="true" />
                  Other <span>{dayList.other.length}</span>
                </h2>
                <ul className="week-list-card">
                  {dayList.other.map((person) => (
                    <DayListRow
                      key={person.userId}
                      person={person}
                      days={days}
                      week={weekOf(person)}
                      dayIndex={dayIndex}
                      onOpen={() => setOpenId(person.userId)}
                    />
                  ))}
                </ul>
              </section>
            )}
            {listFilter === 'all' && dayList.inOffice.length > 0 && (
              <section
                className="week-list-group"
                aria-label={`In office ${weekday}, away other days`}
              >
                <h2>
                  <i className="tone-dot tone" data-tone="office" aria-hidden="true" />
                  In office {weekday}, away other days <span>{dayList.inOffice.length}</span>
                </h2>
                <div className="week-list-card">
                  <button
                    className="week-list-more"
                    aria-expanded={showInOffice}
                    onClick={() => setShowInOffice((shown) => !shown)}
                  >
                    <span className="week-list-stack" aria-hidden="true">
                      {dayList.inOffice.slice(0, 4).map((person) => (
                        <Avatar key={person.userId} person={person} size={26} />
                      ))}
                    </span>
                    <small>
                      {dayList.inOffice
                        .slice(0, 3)
                        .map((person) => person.firstName || personName(person))
                        .join(', ')}
                      {dayList.inOffice.length > 3 && ` +${dayList.inOffice.length - 3}`}
                    </small>
                    <ChevronDown size={16} className="group-chevron" aria-hidden="true" />
                  </button>
                  <div className="group-collapse" data-collapsed={!showInOffice || undefined}>
                    <ul>
                      {dayList.inOffice.map((person) => (
                        <DayListRow
                          key={person.userId}
                          person={person}
                          days={days}
                          week={weekOf(person)}
                          dayIndex={dayIndex}
                          detail={nextException(person)}
                          onOpen={() => setOpenId(person.userId)}
                        />
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
            )}
            {!colleagues.length && <p className="week-empty">{emptyMessage}</p>}
          </section>
          <WeekLegend />
        </main>
        <aside
          className="day-panel"
          aria-label={`Who is where on ${formatDay(selectedDay, { weekday: 'long' })}`}
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
              <h2>{formatDay(selectedDay, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
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
            {groups.map(({ key, label, members: groupMembers }) => {
              const members = groupMembers.filter((person) => hasExceptionOn(person, dayIndex));
              if (!members.length) return null;
              return (
                <section key={key} className="day-panel-group" aria-label={label}>
                  <h3>
                    <button
                      type="button"
                      aria-expanded={!collapsedGroups.has(`sidebar-${key}`)}
                      onClick={(event) => toggleGroup('sidebar', key, event.detail)}
                    >
                      <ChevronDown size={16} className="group-chevron" aria-hidden="true" />
                      {label} <span>{members.length}</span>
                    </button>
                  </h3>
                  <div
                    className="group-collapse"
                    data-collapsed={collapsedGroups.has(`sidebar-${key}`) || undefined}
                  >
                    <ul>
                      {members.map((person) => {
                        const status = statusOn(person, dayIndex);
                        const { label: statusLabel, tone } = presenceOf(status);
                        const note = dayNote(status);
                        const detail = [statusLabel, note].filter(Boolean).join(' · ');
                        return (
                          <li key={person.userId}>
                            <button onClick={() => setOpenId(person.userId)}>
                              <Avatar person={person} size={28} />
                              <span className="day-panel-person">
                                <span>{personName(person)}</span>
                                {detail && <small>{detail}</small>}
                              </span>
                              <i className="tone-dot tone" data-tone={tone} aria-hidden="true" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </section>
              );
            })}
          </div>
        </aside>
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
