import { UseFormReturn } from 'react-hook-form';
import type { StatusFormValues } from '@/components/StatusForm/StatusForm';

import './SetDetailsStep.css';

import { ActionTime } from '@/components/Fields/ActionTime';
import { DetailsField } from '@/components/Fields/DetailsField';
import { EchoField } from '@/components/Fields/EchoField';
import { WhenField } from '@/components/Fields/WhenField';

type SetDetailsStepProps = {
  setCurrentStep?: (step: number) => void;
  currentStep?: number;
  form: UseFormReturn<StatusFormValues>;
  weekStart: string;
  /** Offer "Post in #wørk". Only for the person's own status, never one set for a colleague. */
  showEcho?: boolean;
};

export function SetDetailsStep({ form, weekStart, showEcho = false }: SetDetailsStepProps) {
  return (
    <div className="status-details">
      <WhenField form={form} weekStart={weekStart} />
      <ActionTime form={form} />
      <DetailsField form={form} />
      {showEcho && <EchoField form={form} />}
    </div>
  );
}
