import { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { formSchema } from '@/components/StatusForm/StatusForm';

import './SetDetailsStep.css';
import { DatePickerWithRange } from '@/components/DateRangePicker/DateRangePicker';

import { ActionTime } from '@/components/Fields/ActionTime';
import { DetailsField } from '@/components/Fields/DetailsField';

type SetDetailsStepProps = {
  setCurrentStep?: (step: number) => void;
  currentStep?: number;
  form: UseFormReturn<z.infer<typeof formSchema>>;
};

export function SetDetailsStep({ form }: SetDetailsStepProps) {
  return (
    <div className={'md:pt-8 flex flex-col gap-8'}>
      <DatePickerWithRange form={form} />

      <ActionTime form={form} />
      <DetailsField form={form} />
    </div>
  );
}
