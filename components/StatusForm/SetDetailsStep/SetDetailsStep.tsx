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
    <>
      {chosenStatus === 'ON_LEAVE' || chosenStatus === 'VACATION' ? (
        <FormField
          name={'fromDate'}
          control={form?.control}
          render={() => (
            <FormItem className={'flex'}>
              <FormLabel>Dates</FormLabel>
              <FormControl>
                <div className="flex flex-col gap-2">
                  <DatePickerWithRange form={form} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}
      {chosenStatus !== 'ON_LEAVE' &&
      chosenStatus !== 'VACATION' &&
      chosenStatus !== 'SICK' &&
      chosenStatus !== undefined ? (
        <FormField
          name={'detailsString'}
          control={form?.control}
          render={({ field }) => (
            <FormItem className={'flex gap-11 justify-between items-end'}>
              <FormLabel>Details</FormLabel>
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
      {chosenStatus === 'IN_LATE' || chosenStatus === 'LEAVING_EARLY' ? (
        <FormField
          name={'actionTime'}
          control={form?.control}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <div className="flex flex-col gap-2">
                  <Input {...field} type="time" id="action-time" name="Action Time" required />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}
      {/*<Button*/}
      {/*  ariaLabel={'Press to go back'}*/}
      {/*  handleClick={() => {*/}
      {/*    if (currentStep && setCurrentStep) setCurrentStep(currentStep - 1);*/}
      {/*  }}*/}
      {/*>*/}
      {/*  Go Back*/}
      {/*</Button>*/}
    </>
  );
}
