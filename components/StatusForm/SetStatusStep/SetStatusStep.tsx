import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Button } from '@/components/ui/Button/Button';
import { UserStatus } from '@/db/types';
import { statusOptions } from '@/components/AppContent';
import { useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { formSchema } from '@/components/StatusForm/StatusForm';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type SetStatusStepProps = {
  // handleSetStatus: (status: UserStatus) => void;
  setCurrentStep: (step: number) => void;
  form: UseFormReturn<z.infer<typeof formSchema>>;
  /** Called after a status is chosen, before moving on to the details. */
  onChoose?: (status: UserStatus) => void;
};

export function SetStatusStep({ setCurrentStep, form, onChoose }: SetStatusStepProps) {
  const [showOther, setShowOther] = useState(false);
  const presentOptions = showOther ? statusOptions.otherOptions : statusOptions.mainOptions;

  // 4. Button handler to set status
  function handleSetStatus(status: UserStatus) {
    form.setValue('status', status);
    onChoose?.(status);
    setCurrentStep(2);
  }

  return (
    <FormField
      name={'status'}
      control={form?.control}
      render={() => (
        <FormItem>
          <FormLabel className={'hidden'}>Set your status</FormLabel>
          <FormControl>
            <div className="status-options">
              {presentOptions.map((option, index) => {
                return (
                  <Button
                    key={`${index}-${option.label}-${option.value}`}
                    ariaLabel={`set-status-to-${option.value}`}
                    handleClick={() => handleSetStatus(option.value as UserStatus)}
                    variant={'large'}
                    className="status-option"
                  >
                    <span>{option.label}</span>
                    <ChevronRight size={18} aria-hidden="true" />
                  </Button>
                );
              })}
              <Button
                ariaLabel="status-button"
                handleClick={() => setShowOther(!showOther)}
                variant={'large'}
                className="status-option status-option-more"
              >
                <span>{showOther ? 'Back' : 'Other'}</span>
                {showOther ? (
                  <ChevronLeft size={18} aria-hidden="true" />
                ) : (
                  <ChevronRight size={18} aria-hidden="true" />
                )}
              </Button>
            </div>
          </FormControl>
        </FormItem>
      )}
    />
  );
}
