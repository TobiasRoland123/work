'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Form, FormMessage } from '@/components/ui/form';
import React, { useState } from 'react';
import { userStatus } from '@/db/schema';
import { SetStatusStep } from '@/components/StatusForm/SetStatusStep/SetStatusStep';
import { SetDetailsStep } from '@/components/StatusForm/SetDetailsStep/SetDetailsStep';
import { createNewStatusAction } from '@/app/actions/statusActions';
import { Status } from '@/components/ui/Status/Status';
import { Button } from '@/components/ui/Button/Button';
import { toast } from 'sonner';
import { timeStringToDate } from '@/utils/TimeConverter';

const dateRangeSchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
});

export const formSchema = z
  .object({
    status: z.enum(userStatus.enumValues),
    detailsString: z.string().optional(),
    actionTime: z.string().time().optional(),
    dateRange: dateRangeSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === 'VACATION' || data.status === 'ON_LEAVE') {
      const to = data.dateRange?.to;
      const today = new Date().toISOString().split('T')[0];

      if (!data.dateRange?.from || !data.dateRange?.to) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dateRange'],
          message: 'Both from and to dates are required.',
        });
      }

      if (to && to < today) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dateRange'],
          message: 'End date must be today or in the future.',
        });
      }
    }
    if (data.status === 'IN_LATE' || data.status === 'LEAVING_EARLY') {
      if (!data.actionTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['actionTime'],
          message: 'Time is required for this status.',
        });
      } else {
        const now = new Date();
        const [hours, minutes] = data.actionTime.split(':').map(Number);
        const actionDate = new Date();
        actionDate.setHours(hours, minutes, 0, 0);

        if (actionDate <= now) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['actionTime'],
            message: 'Time must be in the future.',
          });
        }
      }
    }
  });

type StatusFormProps = {
  closeButton?: React.ReactNode;
  userId?: string;
  currentStep: number;
  setCurrentStep: (currentStep: number) => void;
  setOpenSidebar?: (open: 'navigation' | 'status') => void;
  setOpenDrawer?: (open: boolean) => void;
};

export function StatusForm({
  closeButton,
  userId,
  currentStep,
  setCurrentStep,
  setOpenSidebar,
  setOpenDrawer,
}: StatusFormProps) {
  // const session = await();

  // 2. Add "status" to defaultValues
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { detailsString: '' },
  });

  const [isLoading, setIsLoading] = useState(false);

  // if (!userId) return <div>Could not update Status.</div>;
  // 3. Update handler to show status toos
  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!userId) return;

    try {
      setIsLoading(true);
      let newStatus;
      if (values.status === 'SICK') {
        newStatus = await createNewStatusAction({
          userID: userId,
          status: values.status,
        });
      } else {
        newStatus = await createNewStatusAction({
          userID: userId,
          status: values.status,
          details: values.detailsString,
          time: values.actionTime ? timeStringToDate(values.actionTime) : null,
          fromDate: values.dateRange?.from,
          toDate: values.dateRange?.to,
        });
      }

      if (newStatus && newStatus.status) {
        if (setOpenSidebar) {
          setOpenSidebar('navigation');
          setTimeout(() => {
            setCurrentStep(1);
          }, 500);
        }
        if (setOpenDrawer) {
          setOpenDrawer(false);
          setTimeout(() => {
            setCurrentStep(1);
          }, 500);
        }
        form.reset();
        setIsLoading(false);
        toast('Status has been updated✨');
      } else toast('Something went wrong, status not updated 🚫');
    } catch (error) {
      // Handle error (e.g., show a notification)
      console.error(error);
      setIsLoading(false);
    }
  }

  const currentStatus = form.watch('status');

  return (
    <>
      <header
        className={'flex justify-between items-center relative'}
        aria-label="Status Form Header"
      >
        <h3>
          {currentStatus && currentStatus !== 'IN_OFFICE' && currentStep !== 1 ? (
            <Status status={currentStatus} asLabel={false} />
          ) : (
            'Where are you today?'
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
            {currentStep === 1 && <SetStatusStep setCurrentStep={setCurrentStep} form={form} />}
            {currentStep === 2 && (
              <SetDetailsStep
                setCurrentStep={setCurrentStep}
                form={form}
                currentStep={currentStep}
              />
            )}
            {currentStep === 2 ? (
              <div className="flex flex-col gap-3.5 text-black pb-8 mt-auto">
                <Button
                  ariaLabel={'Register Status'}
                  type="submit"
                  variant={'large'}
                  isLoading={isLoading}
                >
                  Register
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
