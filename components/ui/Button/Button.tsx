import { linkProps } from '@/types/link';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { cva } from 'class-variance-authority';
import React from 'react';

type ButtonProps = {
  label?: string;
  children?: React.ReactNode;
  variant?: 'default' | 'large';
  link?: linkProps; // If link is present, then the button component will render as a Link
  className?: string;
};

const variants = cva(
  'bg-light-blue text-black font-mono px-5 py-3.5 hover:bg-light-blue-hover active:bg-light-blue-pressed text-center w-fit focus:outline-light-blue-focus',
  {
    variants: {
      variant: {
        default: 'rounded-[35px] text-base',
        large: 'text-24 rounded-[48px] w-full',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);
export function Button({ label, variant, link, children, className }: ButtonProps) {
  // if (!label || !link || !children) return null;

  if ((link && link?.href && link?.label) || (link && link.href && children)) {
    return (
      <Link
        href={link.href}
        target={link.target || '_self'}
        className={cn(variants({ variant, className }))}
      >
        {link.label || children}
      </Link>
    );
  }
  return <button className={cn(variants({ variant, className }))}>{label || children}</button>;
}
