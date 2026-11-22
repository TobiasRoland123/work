import { useState } from 'react';
import { addMonths, format, parseISO, startOfMonth } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { addDays, formatDay, shiftWorkWeek, workWeekStart } from '@/lib/status/week';

function weekInterval(monday: string) {
  const friday = addDays(monday, 4);
  const sameMonth = monday.slice(0, 7) === friday.slice(0, 7);
  const sameYear = monday.slice(0, 4) === friday.slice(0, 4);
  const first = formatDay(monday, {
    day: 'numeric',
    month: sameMonth ? undefined : 'short',
    year: sameYear ? undefined : 'numeric',
  });
  const last = formatDay(friday, {
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
  });
  return first + '–' + last;
}

function WeekPicker({
  selectedWeek,
  onSelect,
}: {
  selectedWeek: string;
  onSelect: (monday: string) => void;
}) {
  const [month, setMonth] = useState(() => startOfMonth(parseISO(selectedWeek)));
  const firstOfMonth = format(month, 'yyyy-MM-dd');
  const nextMonth = format(addMonths(month, 1), 'yyyy-MM-dd');
  const weeks: string[] = [];
  for (
    let monday = workWeekStart(firstOfMonth);
    monday < nextMonth;
    monday = shiftWorkWeek(monday, 1)
  ) {
    weeks.push(monday);
  }

  return (
    <div className="w-60 p-3">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-7"
          aria-label="Go to previous month"
          onClick={() => setMonth((current) => addMonths(current, -1))}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <p className="text-sm font-medium" aria-live="polite">
          {formatDay(firstOfMonth, { month: 'long', year: 'numeric' })}
        </p>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-7"
          aria-label="Go to next month"
          onClick={() => setMonth((current) => addMonths(current, 1))}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
      <ul className="mt-3 space-y-1">
        {weeks.map((monday) => (
          <li key={monday}>
            <Button
              type="button"
              variant={monday === selectedWeek ? 'default' : 'ghost'}
              size="sm"
              className="w-full justify-start"
              aria-current={monday === selectedWeek ? true : undefined}
              onClick={() => onSelect(monday)}
            >
              {weekInterval(monday)}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DatePickerButton({
  date,
  scope,
  today,
  onNavigate,
}: {
  date: string;
  scope: 'day' | 'week';
  today: string;
  onNavigate?: (href: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = scope === 'week' ? 'Choose week' : 'Choose date';
  const selected = parseISO(date);

  function choose(destination: string) {
    setOpen(false);
    const href = `/today?${scope}=${destination}`;
    if (onNavigate) onNavigate(href);
    else window.location.assign(href);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={label} title={label}>
          <CalendarDays size={18} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0" aria-label={label}>
        {scope === 'week' ? (
          <WeekPicker key={date} selectedWeek={date} onSelect={choose} />
        ) : (
          <Calendar
            mode="single"
            required
            initialFocus
            weekStartsOn={1}
            selected={selected}
            defaultMonth={selected}
            today={parseISO(today)}
            onSelect={(date) => {
              if (date) choose(format(date, 'yyyy-MM-dd'));
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
