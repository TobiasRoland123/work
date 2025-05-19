'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

// import { Input } from "@/components/ui/input"
import { Button } from '@/components/ui/Button/Button';
import { statusOptions } from '@/components/AppContent';
import { useState } from 'react';
import { userStatus } from '@/db/schema';
import { UserStatus } from '@/db/types';
import { SetStatusStep } from '@/components/StatusForm/SetStatusStep/SetStatusStep';
import { SetDetailsStep } from '@/components/StatusForm/SetDetailsStep/SetDetailsStep';

export const formSchema = z
  .object({
    status: z.enum(userStatus.enumValues),
    detailsString: z.string().optional(),
    actionTime: z.string().optional(),
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
  });

export function StatusForm() {
  // 2. Add "status" to defaultValues
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      status: undefined,
      detailsString: '',
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

        {/* Optionally display the status value */}
        <div>Status: {form.watch('status') || '(none set)'}</div>
        <div>detailsString: {form.watch('detailsString') || '(none set)'}</div>
        <button type="submit">Submit</button>
      </form>
    </Form>
  );
}
