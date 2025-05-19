import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Button } from '@/components/ui/Button/Button';
import { UserStatus } from '@/db/types';
import { statusOptions } from '@/components/AppContent';
import { useState } from 'react';
import { Input } from '@/components/ui/Input/input';
import { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { formSchema } from '@/components/StatusForm/StatusForm';

type SetStatusStepProps = {
  // handleSetStatus: (status: UserStatus) => void;
  setCurrentStep: (step: number) => void;
  form: UseFormReturn<z.infer<typeof formSchema>>;
};

export function SetStatusStep({ setCurrentStep, form }: SetStatusStepProps) {
  const [showOther, setShowOther] = useState(false);
  const presentOptions = showOther ? statusOptions.otherOptions : statusOptions.mainOptions;

  // 4. Button handler to set status
  function handleSetStatus(status: UserStatus) {
    form.setValue('status', status);
    setCurrentStep(1);
  }

  return (
    <FormField
      name={'status'}
      control={form?.control}
      render={() => (
        <FormItem>
          <FormLabel>Username</FormLabel>
          <FormControl>
            <div className="flex flex-col gap-2">
              {presentOptions.map((option, index) => {
                return (
                  <Button
                    key={`${index}-${option.label}-${option.value}`}
                    ariaLabel={`set-status-to-${option.value}`}
                    handleClick={() => handleSetStatus(option.value as UserStatus)}
                  >
                    {option.label}
                  </Button>
                );
              })}
              <Button ariaLabel="status-button" handleClick={() => setShowOther(!showOther)}>
                Other
              </Button>
            </div>
          </FormControl>
        </FormItem>
      )}
    />
  );
}
