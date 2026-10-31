import type { UserStatus } from '@/db/types';
import { statusEmoji } from '@/lib/status/emoji';

/** Decorative because the adjacent status text already communicates attendance. */
export function StatusEmoji({
  status,
  emoji,
  details,
}: {
  status: UserStatus | null;
  emoji?: string | null;
  details?: string | null;
}) {
  if (!status) return null;
  const value = emoji ?? statusEmoji(status, details);
  return value ? <span aria-hidden="true">{value} </span> : null;
}
