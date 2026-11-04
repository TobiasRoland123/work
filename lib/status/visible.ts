import { sql } from 'drizzle-orm';
import { status, statusSupersessions } from '@/db/schema';

/** Keep superseded source rows for audit and restoration, but never display/count them. */
export function visibleStatusCondition(context?: { messageKey: string; announcedAt: Date }) {
  return sql`not exists (select 1 from ${statusSupersessions}
    join "status" as replacement on replacement.id = ${statusSupersessions.replacementStatusId}
    where ${statusSupersessions.targetStatusId} = ${status.id}
    ${
      context
        ? sql`and replacement.source_message_key is distinct from ${context.messageKey}
      and replacement.announced_at < ${context.announcedAt.toISOString()}::timestamptz`
        : sql``
    })`;
}
