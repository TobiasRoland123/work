import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/Input/input';
import { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { formSchema } from '@/components/StatusForm/StatusForm';

import './SetDetailsStep.css';
import { DatePickerWithRange } from '@/components/DateRangePicker/DateRangePicker';
import { getDetailsPlaceholder } from '@/components/AppContent';

type SetDetailsStepProps = {
  setCurrentStep?: (step: number) => void;
  currentStep?: number;
  form: UseFormReturn<z.infer<typeof formSchema>>;
};

export function SetDetailsStep({ form }: SetDetailsStepProps) {
  const chosenStatus = form.watch('status');
  return (
    <div className={'md:pt-8 flex flex-col gap-8'}>
      {chosenStatus === 'ON_LEAVE' || chosenStatus === 'VACATION' ? (
        <FormField
          name={'fromDate'}
          control={form?.control}
          render={() => (
            <FormItem className={'flex gap-11 justify-between items-end'}>
              <FormLabel className={'min-w-[80px]'}>Dates</FormLabel>
              <FormControl>
                <div className="flex w-full flex-col gap-2">
                  <DatePickerWithRange form={form} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}
      {chosenStatus === 'IN_LATE' || chosenStatus === 'LEAVING_EARLY' ? (
        <FormField
          name={'actionTime'}
          control={form?.control}
          render={({ field }) => (
            <FormItem className={'flex gap-11 justify-between items-end'}>
              <FormLabel className={'min-w-[80px]'}>Time</FormLabel>

              <FormControl className={'w-full'}>
                <div className="flex flex-col gap-2">
                  <Input {...field} type="time" id="action-time" name="Action Time" required />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}
      {chosenStatus !== 'SICK' && chosenStatus !== undefined ? (
        <FormField
          name={'detailsString'}
          control={form?.control}
          render={({ field }) => (
            <FormItem className={'flex gap-11 justify-between items-end'}>
              <FormLabel className={'min-w-[80px]'}>Details</FormLabel>
              <FormControl className={'w-full'}>
                <div className="flex flex-col gap-2">
                  <Input placeholder={getDetailsPlaceholder(form.watch('status'))} {...field} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}
    </div>
  );
}
