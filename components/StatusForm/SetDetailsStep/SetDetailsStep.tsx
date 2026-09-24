import { UseFormReturn } from 'react-hook-form';
import type { StatusFormValues } from '@/components/StatusForm/StatusForm';

import './SetDetailsStep.css';

import { ActionTime } from '@/components/Fields/ActionTime';
import { DetailsField } from '@/components/Fields/DetailsField';
import { WhenField } from '@/components/Fields/WhenField';

type SetDetailsStepProps = {
  setCurrentStep?: (step: number) => void;
  currentStep?: number;
  form: UseFormReturn<StatusFormValues>;
  weekStart: string;
};

export function SetDetailsStep({ form, weekStart }: SetDetailsStepProps) {
  return (
    <div className={'md:pt-8 flex flex-col gap-8'}>
      <WhenField form={form} weekStart={weekStart} />
      <ActionTime form={form} />
      <DetailsField form={form} />
    </div>
  );
}
