import { Sparkles } from 'lucide-react';

type AIIndicatorProps = {
  sourceMessageKey?: string | null;
  position?: 'inline' | 'corner';
};

/** Slack imports include both AI readings and shorthand learned from earlier AI readings. */
export function AIIndicator({ sourceMessageKey, position = 'inline' }: AIIndicatorProps) {
  if (!sourceMessageKey) return null;

  return (
    <span
      className={
        position === 'corner'
          ? 'absolute right-1 top-1 inline-flex shrink-0'
          : 'ml-1.5 inline-flex shrink-0 align-middle'
      }
      data-ai-indicator={position}
      role="img"
      aria-label="AI-assisted"
      title="AI-assisted Slack import"
    >
      <Sparkles size={12} strokeWidth={1.75} aria-hidden="true" />
    </span>
  );
}
