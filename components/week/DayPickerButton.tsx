import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function DayPickerButton({
  day,
  today,
  onNavigate,
}: {
  day: string;
  today: string;
  onNavigate?: (href: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseISO(day);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Choose date" title="Choose date">
          <CalendarDays size={18} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0" aria-label="Choose date">
        <Calendar
          mode="single"
          required
          initialFocus
          weekStartsOn={1}
          selected={selected}
          defaultMonth={selected}
          today={parseISO(today)}
          onSelect={(date) => {
            if (!date) return;
            setOpen(false);
            const href = `/today?day=${format(date, 'yyyy-MM-dd')}`;
            if (onNavigate) onNavigate(href);
            else window.location.assign(href);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
