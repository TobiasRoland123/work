'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Form } from '@/components/ui/form';
import { useState } from 'react';
import { userStatus } from '@/db/schema';
import { SetStatusStep } from '@/components/StatusForm/SetStatusStep/SetStatusStep';
import { SetDetailsStep } from '@/components/StatusForm/SetDetailsStep/SetDetailsStep';

export const formSchema = z
  .object({
    status: z.enum(userStatus.enumValues),
    detailsString: z.string().optional(),
    actionTime: z.string().time().optional(),
    fromDate: z.string().date().optional(),
    toDate: z.string().date().optional(),
  })
  .superRefine((data, ctx) => {
    // Example: require actionTime if status == "IN_LATE" or "LEAVING_EARLY"
    if ((data.status === 'IN_LATE' || data.status === 'LEAVING_EARLY') && !data.actionTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['actionTime'],
        message: 'Time is required for this status.',
      });
    }

    if ((data.status === 'VACATION' || data.status === 'ON_LEAVE') && !data.actionTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fromDate', 'toDate'],
        message: 'Dates are required for this status.',
      });
    }
  });

export function StatusForm() {
  // 2. Add "status" to defaultValues
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      status: undefined,
      detailsString: '',
      actionTime: '11:00',
    },
  });

  // 3. Update handler to show status too
  function onSubmit(values: z.infer<typeof formSchema>) {
    // eslint-disable-next-line no-console
    console.log(values);
  }
  const [currentStep, setCurrentStep] = useState(0);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {currentStep === 0 && <SetStatusStep setCurrentStep={setCurrentStep} form={form} />}
        {currentStep === 1 && (
          <SetDetailsStep setCurrentStep={setCurrentStep} form={form} currentStep={currentStep} />
        )}
        <button type="submit">Submit</button>
      </form>
    </Form>
  );
}
