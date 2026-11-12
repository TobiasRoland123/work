import { UseFormReturn } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import type { StatusFormValues } from '@/components/StatusForm/StatusForm';
import { ECHO_CHANNEL_LABEL } from '@/lib/status/echo';

/** Whether this status is announced in the attendance channel. Being in the office never is. */
export function EchoField({ form }: { form: UseFormReturn<StatusFormValues> }) {
  if (form.watch('status') === 'IN_OFFICE') return null;
  return (
    <FormField
      name="echo"
      control={form.control}
      render={({ field }) => (
        <FormItem>
          <div className="status-echo-field">
            <FormControl>
              <input
                type="checkbox"
                checked={field.value !== false}
                onChange={(event) => field.onChange(event.target.checked)}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            </FormControl>
            <FormLabel>Post in {ECHO_CHANNEL_LABEL}</FormLabel>
            <small>At 08:00 on the first day, with your note.</small>
          </div>
        </FormItem>
      )}
    />
  );
}
