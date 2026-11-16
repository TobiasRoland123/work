import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/className';
import styles from './native-select.module.css';

type NativeSelectProps = Omit<React.ComponentProps<'select'>, 'multiple' | 'size'> & {
  indicator?: React.ReactNode;
};

/** A native dropdown with consistent space around its decorative indicator. */
export function NativeSelect({ className, indicator, ...props }: NativeSelectProps) {
  return (
    <span className={styles.root}>
      <select className={cn(styles.control, className)} {...props} />
      <span className={styles.indicator} aria-hidden="true">
        {indicator ?? <ChevronDown size={16} />}
      </span>
    </span>
  );
}
