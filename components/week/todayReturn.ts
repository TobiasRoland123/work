export type TodayReturnState = {
  /** Whether today is earlier (viewing future) or later (viewing past). */
  direction: 'earlier' | 'later';
  /** Target URL for jumping back to today or the current work week. */
  href: string;
  /** Client-side jump handler when already mounted on /today. */
  jump: () => void;
};

let current: TodayReturnState | null = null;
const listeners = new Set<() => void>();

export function getTodayReturn(): TodayReturnState | null {
  return current;
}

export function setTodayReturn(next: TodayReturnState | null) {
  if (
    current === next ||
    (current !== null &&
      next !== null &&
      current.direction === next.direction &&
      current.href === next.href &&
      current.jump === next.jump)
  ) {
    return;
  }
  current = next;
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeTodayReturn(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
