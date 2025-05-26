import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/Input/input';
import { getDetailsPlaceholder } from '@/components/AppContent';
import { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { formSchema } from '@/components/StatusForm/StatusForm';

type DetailsFieldProps = {
  form: UseFormReturn<z.infer<typeof formSchema>>;
};

export function DetailsField({ form }: DetailsFieldProps) {
  const chosenStatus = form.watch('status');

  if (chosenStatus !== 'SICK' && chosenStatus !== undefined) {
    return (
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
    );
  }
  return null;
}
