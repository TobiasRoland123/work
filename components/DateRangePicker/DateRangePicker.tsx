'use client';

import * as React from 'react';
import { addDays, format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { DateRange } from 'react-day-picker';

import { cn } from '@/lib/className';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { formSchema } from '@/components/StatusForm/StatusForm';
import { useEffect, useState } from 'react';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

type DateRangePickerProps = {
  className?: string;
  form: UseFormReturn<z.infer<typeof formSchema>>;
};

export function DatePickerWithRange({ className, form }: DateRangePickerProps) {
  const chosenStatus = form.watch('status');

  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(),
    to: addDays(new Date(), 7),
  });

  useEffect(() => {
    if (chosenStatus !== 'ON_LEAVE' && chosenStatus !== 'VACATION') return;
    if (date != undefined && date.from && date.to) {
      form.setValue('actionTime', undefined);
      form.setValue('dateRange.from', format(date.from, 'yyy-MM-dd'));
      form.setValue('dateRange.to', format(date.to, 'yyyy-MM-dd'));
    }
  }, [date, form, chosenStatus]);
  if (chosenStatus === 'ON_LEAVE' || chosenStatus === 'VACATION')
    return (
      <FormField
        name={'dateRange'}
        control={form?.control}
        render={({}) => (
          <>
            <FormItem>
              <div className={'flex gap-11 justify-between items-end '}>
                <FormLabel className={'min-w-[80px]'}>Dates</FormLabel>
                <FormControl className={'w-full'}>
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
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          </>
        )}
      />
    );
  return null;
}
