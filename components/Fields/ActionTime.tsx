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
    return (
      <FormField
        name={'actionTime'}
        control={form?.control}
        render={({ field }) => (
          <FormItem>
            <div className={'flex gap-11 justify-between items-end'}>
              <FormLabel className={'min-w-[80px]'}>
                {chosenStatus === 'IN_LATE' ? 'Arriving' : 'Leaving'}
              </FormLabel>

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
