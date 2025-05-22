'use client';

import * as React from 'react';
import { addDays, format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { formSchema } from '@/components/StatusForm/StatusForm';
import { useEffect } from 'react';

type DateRangePickerProps = {
  className?: string;
  form: UseFormReturn<z.infer<typeof formSchema>>;
};

export function DatePickerWithRange({ className, form }: DateRangePickerProps) {
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: new Date(),
    to: addDays(new Date(), 7),
  });

  useEffect(() => {
    if (date != undefined && date.from && date.to) {
      // Convert to ISO date-only strings: 'YYYY-MM-DD'
      const fromDate = date.from.toISOString().slice(0, 10);
      const toDate = date.to.toISOString().slice(0, 10);

      form.setValue('fromDate', fromDate);
      form.setValue('toDate', toDate);
    }
  }, [date, form]);

  return (
    <div className={cn('grid gap-2', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={'ghost'}
            className={cn(
              'justify-start text-left font-normal text-white bg-black border-b-white border-b rounded-none',
              !date && 'text-muted-foreground'
            )}
          >
            <CalendarIcon />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, 'LLL dd')} - {format(date.to, 'LLL dd, yyyy')}
                </>
              ) : (
                format(date.from, 'LLL dd')
              )
            ) : (
              <span>Pick a date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
