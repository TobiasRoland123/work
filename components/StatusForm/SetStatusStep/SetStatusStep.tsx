import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Button } from '@/components/ui/Button/Button';
import { UserStatus } from '@/db/types';
import { statusOptions } from '@/components/AppContent';
import { useState } from 'react';
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
        <FormItem className={'flex h-full justify-end flex-col'} id={'tesing id *****************'}>
          <FormLabel className={'hidden'}>Set your status</FormLabel>
          <FormControl>
            <div className="flex flex-col gap-2 text-black">
              {presentOptions.map((option, index) => {
                return (
                  <Button
                    key={`${index}-${option.label}-${option.value}`}
                    ariaLabel={`set-status-to-${option.value}`}
                    handleClick={() => handleSetStatus(option.value as UserStatus)}
                    variant={'large'}
                  >
                    {option.label}
                  </Button>
                );
              })}
              <Button
                ariaLabel="status-button"
                handleClick={() => setShowOther(!showOther)}
                variant={'large'}
                className={
                  'bg-transparent text-white font-mono border-white border text-3xl hover:text-black hover:bg-white'
                }
              >
                {showOther ? 'Back' : 'Other'}
              </Button>
            </div>
          </FormControl>
        </FormItem>
      )}
    />
  );
}
