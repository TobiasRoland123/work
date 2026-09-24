'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Form, FormMessage } from '@/components/ui/form';
import React, { useState } from 'react';
import { userStatus } from '@/db/schema';
import { SetStatusStep } from '@/components/StatusForm/SetStatusStep/SetStatusStep';
import { SetDetailsStep } from '@/components/StatusForm/SetDetailsStep/SetDetailsStep';
import { planStatusAction } from '@/app/actions/statusActions';
import { Status } from '@/components/ui/Status/Status';
import { Button } from '@/components/ui/Button/Button';
import { toast } from 'sonner';
import { copenhagenDate, copenhagenWallClock } from '@/lib/status/active';
import { rangeStatuses, timedStatuses } from '@/lib/status/plan';
import { formatDay, workWeekDays, workWeekStart } from '@/lib/status/week';

const isoDay = z.string().date();

export const formSchema = z
  .object({
    status: z.enum(userStatus.enumValues),
    detailsString: z.string().optional(),
    actionTime: z.string().time().optional(),
    whenKind: z.enum(['days', 'range']),
    days: z.array(isoDay),
    dateRange: z.object({ from: z.string(), to: z.string() }).optional(),
  })
  .superRefine((data, ctx) => {
    const today = copenhagenDate();
    if (data.whenKind === 'days' && !data.days.length) {
      ctx.addIssue({ code: 'custom', path: ['days'], message: 'Pick at least one day.' });
    }
    if (data.whenKind === 'range') {
      const { from, to } = data.dateRange ?? {};
      if (!from || !to) {
        ctx.addIssue({
          code: 'custom',
          path: ['dateRange'],
          message: 'Both from and to dates are required.',
        });
      } else if (from > to) {
        ctx.addIssue({
          code: 'custom',
          path: ['dateRange'],
          message: 'The end date must be on or after the start date.',
        });
      } else if (to < today) {
        ctx.addIssue({
          code: 'custom',
          path: ['dateRange'],
          message: 'End date must be today or in the future.',
        });
      }
    }
    if (timedStatuses.includes(data.status)) {
      if (!data.actionTime) {
        ctx.addIssue({
          code: 'custom',
          path: ['actionTime'],
          message: 'Time is required for this status.',
        });
      } else if (data.whenKind === 'days' && data.days.includes(today)) {
        const [hours, minutes] = data.actionTime.split(':').map(Number);
        if (copenhagenWallClock(today, hours, minutes) <= new Date()) {
          ctx.addIssue({
            code: 'custom',
            path: ['actionTime'],
            message: 'That time has passed today. Pick a later time or another day.',
          });
        }
      }
    }
  });

export type StatusFormValues = z.infer<typeof formSchema>;

type StatusFormProps = {
  closeButton?: React.ReactNode;
  userId?: string;
  currentStep: number;
  setCurrentStep: (currentStep: number) => void;
  onSaved?: () => void;
  /** Days to preselect, e.g. the day clicked on the week board. */
  initialDays?: string[];
  /** First week offered in the day picker; earlier weeks fall back to the current week. */
  weekStart?: string;
};

/** Today on weekdays, otherwise the coming Monday. */
function defaultDay() {
  const today = copenhagenDate();
  return workWeekDays(workWeekStart(today)).includes(today) ? today : workWeekStart(today);
}

export function describeWhen(values: Pick<StatusFormValues, 'whenKind' | 'days' | 'dateRange'>) {
  const short = (day: string) =>
    formatDay(day, { weekday: 'short', day: 'numeric', month: 'short' });
  if (values.whenKind === 'range') {
    const { from, to } = values.dateRange ?? {};
    if (!from || !to) return null;
    return from === to ? short(from) : `${short(from)} – ${short(to)}`;
  }
  return values.days.length ? values.days.map(short).join(', ') : null;
}

export function StatusForm({
  closeButton,
  userId,
  currentStep,
  setCurrentStep,
  onSaved,
  initialDays,
  weekStart,
}: StatusFormProps) {
  const currentWeek = workWeekStart(copenhagenDate());
  const firstWeek = weekStart && weekStart > currentWeek ? weekStart : currentWeek;
  const presetDays = initialDays?.length ? [...initialDays].sort() : null;
  const form = useForm<StatusFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      detailsString: '',
      whenKind: 'days',
      days: presetDays ?? [defaultDay()],
    },
  });

  const [isLoading, setIsLoading] = useState(false);

  function chooseStatus(status: StatusFormValues['status']) {
    const days = form.getValues('days');
    if (timedStatuses.includes(status)) {
      form.setValue('whenKind', 'days');
    } else if (rangeStatuses.includes(status)) {
      const from = days[0] ?? defaultDay();
      const friday = workWeekDays(workWeekStart(from))[4];
      const last = days.at(-1) ?? from;
      form.setValue('whenKind', 'range');
      form.setValue('dateRange', { from, to: last > friday ? last : friday });
    }
  }

  async function onSubmit(values: StatusFormValues) {
    if (!userId) return;

    try {
      setIsLoading(true);
      const result = await planStatusAction({
        status: values.status,
        details: values.status === 'SICK' ? undefined : values.detailsString,
        time: timedStatuses.includes(values.status) ? values.actionTime : undefined,
        when:
          values.whenKind === 'range'
            ? { kind: 'range', from: values.dateRange?.from, to: values.dateRange?.to }
            : { kind: 'days', days: values.days },
      });

      if (result.ok) {
        const when = describeWhen(values);
        form.reset();
        toast(when ? `Saved for ${when} ✨` : 'Status has been updated✨');
        onSaved?.();
      } else toast(`${result.error} 🚫`);
    } catch (error) {
      console.error(error);
      toast('Something went wrong, status not updated 🚫');
    } finally {
      setIsLoading(false);
    }
  }

  const currentStatus = form.watch('status');
  const when = describeWhen({
    whenKind: form.watch('whenKind'),
    days: form.watch('days'),
    dateRange: form.watch('dateRange'),
  });

  return (
    <>
      <header
        className={'flex justify-between items-center relative'}
        aria-label="Status Form Header"
      >
        <h3>
          {currentStatus && currentStep !== 1 ? (
            <Status status={currentStatus} asLabel={false} />
          ) : (
            'Where will you be?'
          )}
          {currentStep === 1 && presetDays && (
            <small className="status-form-preset">
              {describeWhen({ whenKind: 'days', days: presetDays })}
            </small>
          )}
        </h3>
        {closeButton ? closeButton : null}
      </header>
      <div className={'h-full pb-8 md:pb-0'}>
        <Form {...form}>
          <FormMessage className={'bg-green-500 z-50 text-white'} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit(onSubmit)(e);
            }}
            className="h-full flex flex-col justify-between gap-8 "
          >
            {currentStep === 1 && (
              <SetStatusStep setCurrentStep={setCurrentStep} form={form} onChoose={chooseStatus} />
            )}
            {currentStep === 2 && (
              <SetDetailsStep
                setCurrentStep={setCurrentStep}
                form={form}
                currentStep={currentStep}
                weekStart={firstWeek}
              />
            )}
            {currentStep === 2 ? (
              <div className="flex flex-col gap-3.5 text-black pb-8 mt-auto">
                {when && (
                  <div className="status-form-summary">
                    <Status status={currentStatus} asLabel={false} /> · {when}
                  </div>
                )}
                <Button
                  ariaLabel={'Register Status'}
                  type="submit"
                  variant={'large'}
                  isLoading={isLoading}
                >
                  Save
                </Button>
                <Button
                  ariaLabel={'Go back'}
                  type="button"
                  variant={'large'}
                  handleClick={() => {
                    form.reset();
                    setCurrentStep(currentStep - 1);
                  }}
                >
                  Back
                </Button>
              </div>
            ) : null}
          </form>
        </Form>
      </div>
    </>
  );
}
