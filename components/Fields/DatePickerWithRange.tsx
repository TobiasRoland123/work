import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { formSchema } from '@/components/StatusForm/StatusForm';

// Don't forget to import your DatePickerWithRange if it's separate!
type DatePickerWithRangeProps = {
  form: UseFormReturn<z.infer<typeof formSchema>>;
};

export function DatePickerWithRange({ form }: DatePickerWithRangeProps) {
  const chosenStatus = form.watch('status');

  if (chosenStatus === 'ON_LEAVE' || chosenStatus === 'VACATION') {
    return (
      <FormField
        name={'fromDate'}
        control={form.control}
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
    );
  }

  return null;
}
