'use client';

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { UseFormReturn } from 'react-hook-form';
import type { StatusFormValues } from '@/components/StatusForm/StatusForm';
import { copenhagenDate } from '@/lib/status/active';
import { timedStatuses } from '@/lib/status/plan';
import {
  formatDay,
  isoWeekNumber,
  shiftWorkWeek,
  workWeekDays,
  workWeekStart,
} from '@/lib/status/week';
import './when-field.css';

type WhenFieldProps = {
  form: UseFormReturn<StatusFormValues>;
  /** Monday of the first week offered; the following week is shown too. */
  weekStart: string;
};

export function WhenField({ form, weekStart }: WhenFieldProps) {
  const status = form.watch('status');
  const kind = form.watch('whenKind');
  const days = form.watch('days');
  const range = form.watch('dateRange');
  const today = copenhagenDate();
  const currentWeek = workWeekStart(today);
  const timed = timedStatuses.includes(status);
  const revalidate = { shouldValidate: form.formState.isSubmitted };

  const weekLabel = (monday: string) =>
    monday === currentWeek
      ? 'This week'
      : monday === shiftWorkWeek(currentWeek, 1)
        ? 'Next week'
        : `Week ${isoWeekNumber(monday)}`;

  function toggle(day: string) {
    const next = days.includes(day) ? days.filter((value) => value !== day) : [...days, day];
    form.setValue('days', next.sort(), revalidate);
  }

  function switchKind() {
    if (kind === 'days') {
      const from = days[0] ?? today;
      form.setValue('dateRange', { from, to: days.at(-1) ?? from });
      form.setValue('whenKind', 'range', revalidate);
    } else {
      form.setValue('whenKind', 'days', revalidate);
    }
  }

  return (
    <div className="when-field">
      <div className="when-field-head">
        <span className="when-field-label">When</span>
        {!timed && (
          <button type="button" className="when-field-switch" onClick={switchKind}>
            {kind === 'days' ? 'Longer period' : 'Pick days'}
          </button>
        )}
      </div>
      {kind === 'days' ? (
        <FormField
          name="days"
          control={form.control}
          render={() => (
            <FormItem>
              <FormLabel className="sr-only">Days</FormLabel>
              <FormControl>
                <div className="when-weeks">
                  {[weekStart, shiftWorkWeek(weekStart, 1)].map((monday) => (
                    <fieldset key={monday} className="when-week">
                      <legend>{weekLabel(monday)}</legend>
                      <div className="when-days">
                        {workWeekDays(monday).map((day) => (
                          <button
                            key={day}
                            type="button"
                            aria-pressed={days.includes(day)}
                            aria-label={formatDay(day, {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'long',
                            })}
                            disabled={day < today}
                            onClick={() => toggle(day)}
                          >
                            {formatDay(day, { weekday: 'short' })}
                            <small>{formatDay(day, { day: 'numeric', month: 'short' })}</small>
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : (
        <FormField
          name="dateRange"
          control={form.control}
          render={() => (
            <FormItem>
              <FormLabel className="sr-only">Period</FormLabel>
              <FormControl>
                <div className="when-range">
                  <label>
                    From
                    <input
                      type="date"
                      value={range?.from ?? ''}
                      onChange={(event) => {
                        const from = event.target.value;
                        // Keep the period valid when the start moves past the end.
                        const to = range?.to && range.to >= from ? range.to : from;
                        form.setValue('dateRange', { from, to }, revalidate);
                      }}
                    />
                  </label>
                  <label>
                    To
                    <input
                      type="date"
                      value={range?.to ?? ''}
                      min={range?.from || today}
                      onChange={(event) =>
                        form.setValue(
                          'dateRange',
                          { from: range?.from ?? today, to: event.target.value },
                          revalidate
                        )
                      }
                    />
                  </label>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
}
