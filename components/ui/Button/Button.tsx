import { linkProps } from '@/types/link';
import Link from 'next/link';
import { cn } from '@/lib/className';
import { cva } from 'class-variance-authority';
import React from 'react';
import './button.css';
import { Spinner } from '../Spinner/Spinner';

export type ButtonProps = {
  label?: string;
  children?: React.ReactNode;
  ariaLabel: string;
  variant?: 'default' | 'large';
  link?: linkProps; // If link is present, then the button component will render as a Link
  className?: string;
  handleClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  isLoading?: boolean;
};

const variants = cva(
  'bg-light-blue text-black font-mono px-5 py-3.5 h-14 flex items-center justify-center hover:bg-light-blue-hover active:bg-light-blue-pressed text-center w-fit focus:outline-light-blue-focus cursor-pointer',
  {
    variants: {
      variant: {
        default: 'rounded-[35px] text-base',
        large: 'text-24 rounded-[48px] w-full ',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);
export function Button({
  label,
  variant,
  link,
  ariaLabel,
  children,
  className,
  handleClick,
  type = 'button',
  isLoading = false,
}: ButtonProps) {
  if ((link && link?.href && link?.label) || (link && link.href && children)) {
    return (
      <Link
        href={link.href}
        aria-label={ariaLabel}
        target={link.target || '_self'}
        className={cn(
          variants({ variant, className }),
          isLoading && 'opacity-50 pointer-events-none'
        )}
        tabIndex={isLoading ? -1 : 0}
        aria-disabled={isLoading}
      >
        {isLoading ? <span className="loader mr-2" aria-hidden="true" /> : null}
        {link.label || children}
      </Link>
    );
  }
  return (
    <button
      type={type}
      aria-label={ariaLabel}
      onClick={handleClick}
      className={cn(
        variants({ variant, className }),
        isLoading && 'opacity-50 pointer-events-none'
      )}
      disabled={isLoading}
      aria-busy={isLoading}
    >
      {isLoading ? <Spinner /> : label || children}
    </button>
  );
}
