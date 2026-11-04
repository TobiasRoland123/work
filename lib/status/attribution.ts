import type { Status } from '@/db/types';

export function announcementAttribution(status: Status | null | undefined): string | null {
  if (!status?.sourceMessageKey || !status.sourceAuthor) return null;
  return `Announced by ${status.sourceAuthor.name || 'a colleague'}`;
}
