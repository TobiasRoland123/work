import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/Input/input';
import { z } from 'zod';
import { formSchema } from '@/components/StatusForm/StatusForm';
import { UseFormReturn } from 'react-hook-form';
import { useEffect } from 'react';

type ActionTimeProps = {
  form: UseFormReturn<z.infer<typeof formSchema>>;
};

export function ActionTime({ form }: ActionTimeProps) {
  const chosenStatus = form.watch('status');

  useEffect(() => {
    if (chosenStatus === 'IN_LATE' || chosenStatus === 'LEAVING_EARLY') {
      form.setValue('dateRange', undefined);
      form.setValue('dateRange', undefined);
    }
  }, [chosenStatus, form]);

  if (chosenStatus === 'IN_LATE' || chosenStatus === 'LEAVING_EARLY') {
    return (
      <FormField
        name={'actionTime'}
        control={form?.control}
        render={({ field }) => (
          <FormItem>
            <div className={'flex gap-11 justify-between items-end'}>
              <FormLabel className={'min-w-[80px]'}>Time</FormLabel>

              <FormControl className={'w-full'}>
                <div className="flex flex-col gap-2">
                  <Input
                    {...field}
                    type="time"
                    id="action-time"
                    name="Action Time"
                    required
                    value={field.value ?? ''}
                  />
                </div>
              </FormControl>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  }
  return null;
}
