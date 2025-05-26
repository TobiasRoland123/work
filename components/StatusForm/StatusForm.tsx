'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Form } from '@/components/ui/form';
import React, { useState } from 'react';
import { userStatus } from '@/db/schema';
import { SetStatusStep } from '@/components/StatusForm/SetStatusStep/SetStatusStep';
import { SetDetailsStep } from '@/components/StatusForm/SetDetailsStep/SetDetailsStep';
import { createNewStatusAction } from '@/app/actions/statusActions';
import { Status } from '@/components/ui/Status/Status';
import { Button } from '@/components/ui/Button/Button';
import { toast } from 'sonner';
import { timeStringToDate } from '@/utils/TimeConverter';

export const formSchema = z
  .object({
    status: z.enum(userStatus.enumValues),
    detailsString: z.string().optional(),
    actionTime: z.string().time().optional(),
    fromDate: z.string().date().optional(),
    toDate: z.string().date().optional(),
  })
  .superRefine((data, ctx) => {
    if ((data.status === 'IN_LATE' || data.status === 'LEAVING_EARLY') && !data.actionTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['actionTime'],
        message: 'Time is required for this status.',
      });
    }
    if (data.status === 'VACATION' || data.status === 'ON_LEAVE') {
      if (!data.fromDate || !data.toDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fromDate', 'toDate'],
          message: 'Dates are required for this status.',
        });
      }
    }
  });

type StatusFormProps = {
  closeButton?: React.ReactNode;
  userId?: string;
  setOpenSidebar?: (open: 'navigation' | 'status') => void;
  setOpenDrawer?: (open: boolean) => void;
};

export function StatusForm({
  closeButton,
  userId,
  setOpenSidebar,
  setOpenDrawer,
}: StatusFormProps) {
  // const session = await();
  const [currentStep, setCurrentStep] = useState(1);
  // 2. Add "status" to defaultValues
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {},
  });

  // if (!userId) return <div>Could not update Status.</div>;
  // 3. Update handler to show status toos
  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!userId) return;

    try {
      const newStatus = await createNewStatusAction({
        userID: userId,
        status: values.status,
        details: values.detailsString,
        time: values.actionTime ? timeStringToDate(values.actionTime) : null,
        fromDate: values.fromDate,
        toDate: values.toDate,
      });
      if (newStatus) toast('Status has been updated✨');
      else toast('Something went wrong, status not updated 🚫');
    } catch (error) {
      // Handle error (e.g., show a notification)
      console.error(error);
    }
  }

  const currentStatus = form.watch('status');

  return (
    <>
      <header className={'flex justify-between items-center relative'}>
        <h3>
          {currentStatus && currentStatus !== 'IN_OFFICE' ? (
            <Status status={currentStatus} asLabel={false} />
          ) : (
            'Where are you today?'
          )}
        </h3>
        {closeButton ? closeButton : null}
      </header>
      <div className={'h-full pt-6'}>
        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit(onSubmit)(e);
            }}
            className="h-full flex flex-col gap-8 "
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
              <Button
                ariaLabel={'Register Status'}
                type="submit"
                variant={'large'}
                className={'text-black text-2xl mt-12 md:mt-auto md: mb-5'}
                handleClick={() => {
                  if (setOpenSidebar) {
                    setOpenSidebar('navigation');
                    setTimeout(() => {
                      setCurrentStep(1);
                    }, 500);
                  }
                  if (setOpenDrawer) {
                    setOpenDrawer(false);
                  }
                }}
              >
                Register
              </Button>
            ) : null}
          </form>
        </Form>
      </div>
    </>
  );
}
