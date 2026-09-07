import { createHmac } from 'node:crypto';
import type { AttendanceEntry } from './attendance';
import type { SlackMessage } from './client';

export interface StoredMessage { key: string; contentHash: string; messageTs: string }
export interface AttendanceStore {
  replace(message: StoredMessage, userId: string, entries: AttendanceEntry[], updatedAt: Date): Promise<void>;
  remove(keys: string[]): Promise<void>;
}

export async function reconcileAttendance(options: {
  channel: string; oldest: string; latest: string; messages: SlackMessage[];
  identities: Map<string, string>; stored: StoredMessage[]; hashSecret: string;
  interpret: (text: string, sentAt: Date) => Promise<AttendanceEntry[]>; store: AttendanceStore;
}) {
  const { channel, oldest, latest, messages, identities, stored, hashSecret, interpret, store } = options;
  if (!hashSecret) throw new Error('Missing sync fingerprint secret');
  const known = new Map(stored.map(m => [m.key, m]));
  const present = new Set<string>();
  let processed = 0;
  let failed = 0;
  for (const message of messages) {
    if (Number(message.ts) < Number(oldest) || Number(message.ts) > Number(latest)) continue;
    const key = `${channel}:${message.ts}`;
    if (present.has(key)) continue;
    present.add(key);
    const userId = message.user && identities.get(message.user);
    const eligible = userId && !message.bot_id && (!message.subtype || message.subtype === 'me_message') &&
      (!message.thread_ts || message.thread_ts === message.ts);
    const contentHash = createHmac('sha256', hashSecret).update(JSON.stringify(['attendance-v1', userId ?? null, message.text ?? '', message.edited?.ts ?? null, !!eligible])).digest('hex');
    if (known.get(key)?.contentHash === contentHash) continue;
    try {
      const entries = eligible && message.text ? await interpret(message.text, new Date(Number(message.ts) * 1000)) : [];
      const updatedAt = new Date(Number(message.edited?.ts ?? message.ts) * 1000);
      if (!Number.isFinite(updatedAt.getTime())) throw new Error('Invalid message timestamp');
      // No raw text or reasons cross the persistence boundary.
      await store.replace({ key, contentHash, messageTs: message.ts }, userId || '', entries, updatedAt);
      processed++;
    } catch {
      // Retain the prior result and fingerprint so a failed edit can be retried.
      failed++;
    }
  }
  const removed = stored.filter(m => Number(m.messageTs) >= Number(oldest) && Number(m.messageTs) <= Number(latest) && !present.has(m.key)).map(m => m.key);
  if (removed.length) await store.remove(removed);
  return { processed, failed, removed: removed.length };
}
