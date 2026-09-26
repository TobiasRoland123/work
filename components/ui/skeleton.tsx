import { cn } from '@/lib/className';

const skeletonClass =
  'animate-pulse rounded-[4px] bg-[#e4e3d8] motion-reduce:animate-none dark:bg-(--office-border-soft)';

/** A placeholder block with an explicit size, such as an avatar or a button. */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(skeletonClass, className)}
      {...props}
    />
  );
}

/**
 * A placeholder for one line of text. It is exactly one line tall in the surrounding font, so
 * placing it inside the element the real text would use (an h1, a small, a table cell) keeps
 * the layout identical when the content arrives. Set the expected text width with className.
 */
function SkeletonText({ className }: { className?: string }) {
  // Page styles target descendant spans (for counts and badges); always follow the parent's font.
  const reset = { font: 'inherit', margin: 0 };
  return (
    <span aria-hidden="true" className="flex h-[1lh] min-w-0 items-center" style={reset}>
      <span
        data-slot="skeleton"
        className={cn(skeletonClass, 'block h-[0.7em] max-w-full', className)}
        style={reset}
      />
    </span>
  );
}

export { Skeleton, SkeletonText };
