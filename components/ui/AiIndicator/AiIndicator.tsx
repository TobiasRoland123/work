'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip/tooltip';
import { cn } from '@/lib/className';

export const AI_INDICATOR_LABEL = 'Set by AI';

const mark =
  'inline-flex size-3 shrink-0 items-center justify-center align-middle text-current';

/**
 * Marks a status the model interpreted from a Declaration. Pass `interactive={false}` inside
 * another control, which must then announce the label itself.
 */
export function AiIndicator({
  interactive = true,
  className,
}: {
  interactive?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!interactive)
    return (
      <span className={cn(mark, className)} title={AI_INDICATOR_LABEL} aria-hidden="true">
        <Sparkles size={9} strokeWidth={2.25} />
      </span>
    );
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={AI_INDICATOR_LABEL}
          // Suppress a native title inherited from the surrounding cell.
          title=""
          className={cn(
            mark,
            // Widen the touch target without moving the surrounding text.
            "relative cursor-help rounded-sm after:absolute after:-inset-2.5 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current",
            className
          )}
          // A tap opens the explanation; tapping elsewhere or Escape closes it.
          onClick={(event) => {
            event.preventDefault();
            setOpen(true);
          }}
          // A touch pointer leaves when the finger lifts, which would close the tooltip at once.
          onPointerLeave={(event) => {
            if (event.pointerType === 'touch') event.preventDefault();
          }}
        >
          <Sparkles size={9} strokeWidth={2.25} aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent sideOffset={6}>{AI_INDICATOR_LABEL} from the Slack message</TooltipContent>
    </Tooltip>
  );
}
