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

  if (
    chosenStatus === 'IN_OFFICE' ||
    chosenStatus === 'IN_LATE' ||
    chosenStatus === 'LEAVING_EARLY'
  ) {
    return (
      <FormField
        name={'actionTime'}
        control={form?.control}
        render={({ field }) => (
          <FormItem>
            <div className="status-details-field">
              <FormLabel>
                {chosenStatus === 'LEAVING_EARLY'
                  ? 'Leaving'
                  : chosenStatus === 'IN_OFFICE'
                    ? 'Arriving (optional)'
                    : 'Arriving'}
              </FormLabel>

              <FormControl>
                <Input
                  {...field}
                  type="time"
                  required={chosenStatus !== 'IN_OFFICE'}
                  value={field.value ?? ''}
                />
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
