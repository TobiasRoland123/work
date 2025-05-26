'use client';

import * as React from 'react';
import { XIcon } from 'lucide-react';

import { cn } from '@/lib/className';
import { Button } from '../Button/Button';

// Context to manage the sheet state
interface InsetSheetContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side: 'top' | 'right' | 'bottom' | 'left';
}

const InsetSheetContext = React.createContext<InsetSheetContextValue>({
  open: false,
  onOpenChange: () => {},
  side: 'right',
});

interface InsetSheetProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

function InsetSheet({
  children,
  className,
  open,
  onOpenChange,
  side = 'right',
  ...props
}: InsetSheetProps) {
  const [isOpen, setIsOpen] = React.useState(open || false);

  React.useEffect(() => {
    if (open !== undefined) {
      setIsOpen(open);
    }
  }, [open]);

  const handleOpenChange = React.useCallback(
    (value: boolean) => {
      setIsOpen(value);
      onOpenChange?.(value);
    },
    [onOpenChange]
  );

  return (
    <InsetSheetContext.Provider
      value={{
        open: isOpen,
        onOpenChange: handleOpenChange,
        side,
      }}
    >
      <div data-slot="inset-sheet" className={cn('relative', className)} {...props}>
        {children}
      </div>
    </InsetSheetContext.Provider>
  );
}

const useInsetSheet = () => {
  const context = React.useContext(InsetSheetContext);
  if (!context) {
    throw new Error('useInsetSheet must be used within an InsetSheetProvider');
  }
  return context;
};

// Variants for different sides
const sideVariants = {
  top: 'inset-x-0 top-0 border-b',
  right: 'inset-y-0 right-0 h-full border-l',
  bottom: 'inset-x-0 bottom-0 border-t',
  left: 'inset-y-0 left-0 h-full border-r',
};

interface InsetSheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: 'top' | 'right' | 'bottom' | 'left';
  hideCloseButton?: boolean;
}

function InsetSheetOverlay() {
  const { open, onOpenChange } = useInsetSheet();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 transition-opacity"
      onClick={() => onOpenChange(false)}
      aria-hidden="true"
    />
  );
}

function InsetSheetContent({
  children,
  className,
  hideCloseButton = false,
  side,
  ...props
}: InsetSheetContentProps) {
  const { open, onOpenChange, side: contextSide } = useInsetSheet();
  const activeSide = side || contextSide;

  // Calculate transform values based on side and open state
  const getTransform = () => {
    if (!open) {
      switch (activeSide) {
        case 'top':
          return 'translateY(-100%)';
        case 'bottom':
          return 'translateY(100%)';
        case 'left':
          return 'translateX(-100%)';
        case 'right':
          return 'translateX(100%)';
      }
    }
    return 'translate(0, 0)';
  };

  // Calculate dimensions based on side
  const getDimensions = () => {
    switch (activeSide) {
      case 'top':
      case 'bottom':
        return 'max-h-screen';
      case 'left':
      case 'right':
        return 'w-3/4 sm:max-w-sm';
    }
  };

  return (
    <>
      <InsetSheetOverlay />
      <div
        data-slot="inset-sheet-content"
        data-state={open ? 'open' : 'closed'}
        className={cn(
          'bg-background fixed z-50 flex h-full flex-col gap-4 shadow-lg transition-transform duration-200 ease-in-out',
          sideVariants[activeSide],
          getDimensions(),
          className
        )}
        style={{
          transform: getTransform(),
        }}
        {...props}
      >
        {children}
        {!hideCloseButton && (
          <button
            aria-label="Close inset sheet button"
            type="button"
            onClick={() => onOpenChange(false)}
            className="ring-offset-background focus:ring-ring absolute right-4 top-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none"
          >
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </button>
        )}
      </div>
    </>
  );
}

interface InsetSheetTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

function InsetSheetTrigger({ children, ...props }: InsetSheetTriggerProps) {
  const { onOpenChange } = useInsetSheet();
  return (
    <Button
      data-slot="inset-sheet-trigger"
      ariaLabel="Open status sheet"
      handleClick={() => onOpenChange(true)}
      {...props}
    >
      {children}
    </Button>
  );
}

type InsetSheetWrapperProps = React.HTMLAttributes<HTMLDivElement>;

function InsetSheetWrapper({ children, className, ...props }: InsetSheetWrapperProps) {
  const { open, side } = useInsetSheet();

  // Calculate padding based on side and open state
  const getPadding = () => {
    if (!open) return {};

    switch (side) {
      case 'top':
        return { paddingTop: 'var(--sheet-height, 40vh)' };
      case 'bottom':
        return { paddingBottom: 'var(--sheet-height, 40vh)' };
      case 'left':
        return { paddingLeft: 'var(--sheet-width, 24rem)' };
      case 'right':
        return { paddingRight: 'var(--sheet-width, 24rem)' };
    }
  };

  return (
    <div
      data-slot="inset-sheet-wrapper"
      className={cn('transition-all duration-200 ease-in-out', className)}
      style={getPadding()}
      {...props}
    >
      {children}
    </div>
  );
}

function InsetSheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="inset-sheet-header"
      className={cn('flex flex-col gap-1.5 p-4', className)}
      {...props}
    />
  );
}

function InsetSheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="inset-sheet-footer"
      className={cn('mt-auto flex flex-col gap-2 p-4', className)}
      {...props}
    />
  );
}

function InsetSheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      data-slot="inset-sheet-title"
      className={cn('text-foreground font-semibold', className)}
      {...props}
    />
  );
}

function InsetSheetDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <div
      data-slot="inset-sheet-description"
      className={cn('text-muted-foreground', className)}
      {...props}
    />
  );
}
interface InsetSheetCloseProps {
  children: React.ReactNode;
  asChild?: boolean;
  className?: string;
  // other props
}

function InsetSheetClose({ children, className, ...props }: InsetSheetCloseProps) {
  const { onOpenChange } = useInsetSheet();
  return (
    <button
      className={className}
      aria-label="Close inset sheet button"
      data-slot="inset-sheet-close"
      onClick={() => onOpenChange(false)}
      {...props}
    >
      {children}
    </button>
  );
}

export {
  InsetSheet,
  InsetSheetTrigger,
  InsetSheetContent,
  InsetSheetHeader,
  InsetSheetFooter,
  InsetSheetTitle,
  InsetSheetDescription,
  InsetSheetWrapper,
  InsetSheetClose,
};
