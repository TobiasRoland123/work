import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/Input/input';
import { z } from 'zod';
import { formSchema } from '@/components/StatusForm/StatusForm';
import { UseFormReturn } from 'react-hook-form';

type ActionTimeProps = {
  form: UseFormReturn<z.infer<typeof formSchema>>;
};

export function ActionTime({ form }: ActionTimeProps) {
  const chosenStatus = form.watch('status');

  if (chosenStatus === 'IN_LATE' || chosenStatus === 'LEAVING_EARLY') {
    form.setValue('fromDate', undefined);
    form.setValue('toDate', undefined);
    return (
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
    );
  }
  return null;
}
