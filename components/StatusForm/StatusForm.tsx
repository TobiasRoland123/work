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
};

export function StatusForm({ closeButton, userId }: StatusFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  // 2. Add "status" to defaultValues
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {},
  });

  if (!userId) return <div>Could not update Status.</div>;
  // 3. Update handler to show status too
  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!userId) return;
    // eslint-disable-next-line no-console
    console.log(values);
    await createNewStatusAction({
      userID: userId,
      status: values.status,
      details: values.detailsString,
      time: values.actionTime,
      fromDate: values.fromDate,
      toDate: values.toDate,
    });
  }

  const currentStatus = form.watch('status');

  return (
    <>
      <header className={'flex justify-between items-center'}>
        <h3>
          {currentStatus && currentStatus !== 'IN_OFFICE' ? currentStatus : 'Where are you today?'}
        </h3>
        {closeButton ? closeButton : null}
      </header>
      <div className={'h-full pb-6'}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="py-2 h-full  ">
            {currentStep === 1 && <SetStatusStep setCurrentStep={setCurrentStep} form={form} />}
            {currentStep === 2 && (
              <SetDetailsStep
                setCurrentStep={setCurrentStep}
                form={form}
                currentStep={currentStep}
              />
            )}
            {currentStep === 2 ? <button type="submit">Submit</button> : null}
          </form>
        </Form>
      </div>
    </>
  );
}
