import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/Input/input';
import { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { formSchema } from '@/components/StatusForm/StatusForm';
import { Button } from '@/components/ui/Button/Button';
import './SetDetailsStep.css';

type SetDetailsStepProps = {
  setCurrentStep?: (step: number) => void;
  currentStep?: number;
  form: UseFormReturn<z.infer<typeof formSchema>>;
};

export function SetDetailsStep({ form, setCurrentStep, currentStep }: SetDetailsStepProps) {
  const chosenStatus = form.watch('status');
  return (
    <>
      <Button
        ariaLabel={'Press to go back'}
        handleClick={() => {
          if (currentStep && setCurrentStep) setCurrentStep(currentStep - 1);
        }}
      >
        Go Back
      </Button>
      {chosenStatus !== 'SICK' || undefined ? (
        <FormField
          name={'detailsString'}
          control={form?.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reason</FormLabel>
              <FormControl>
                <div className="flex flex-col gap-2">
                  <Input placeholder="Reason" {...field} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}
      {chosenStatus === 'IN_LATE' || 'LEAVING_EARLY' ? (
        <FormField
          name={'actionTime'}
          control={form?.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reason</FormLabel>
              <FormControl>
                <div className="flex flex-col gap-2">
                  {/*<Input placeholder="Reason" {...field} />*/}
                  <Input
                    type="time"
                    id="appointment"
                    name="appointment"
                    min="09:00"
                    max="18:00"
                    required
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}
    </>
  );
}
