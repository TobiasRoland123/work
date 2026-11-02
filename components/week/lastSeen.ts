import { useCallback, useEffect, useState } from 'react';

const storageKey = (userId: string) => `week-last-seen:${userId}`;

// The last moment this browser showed the person the Week page, so the board can point out
// announcements made since. Stored in the browser like the Palette, not per person.
function readSeen(userId: string): number | null {
  try {
    const stored = Number(window.localStorage.getItem(storageKey(userId)));
    return Number.isFinite(stored) && stored > 0 ? stored : null;
  } catch {
    return null;
  }
}

function writeSeen(userId: string, at = Date.now()) {
  try {
    window.localStorage.setItem(storageKey(userId), String(at));
  } catch {
    // Private browsing or a full quota: the board simply has nothing to point out next time.
  }
}

/**
 * When the person last looked at the Week page, in epoch milliseconds, or null until the browser
 * has been asked. Fixed while the page stays in view, so announcements arriving live keep
 * standing out, and moved forward each time the page comes back into view.
 */
export function useLastSeen(userId: string) {
  const [seenSince, setSeenSince] = useState<number | null>(null);

  useEffect(() => {
    // A first visit has nothing to compare with, so nothing counts as new.
    const look = () => setSeenSince(readSeen(userId) ?? Date.now());
    const remember = () => writeSeen(userId);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') look();
      else remember();
    };
    look();
    // Recorded while in view too, so leaving through an in-app link still counts as having looked.
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') remember();
    }, 15_000);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', remember);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', remember);
    };
  }, [userId]);

  const markSeen = useCallback(() => {
    const now = Date.now();
    writeSeen(userId, now);
    setSeenSince(now);
  }, [userId]);

  return { seenSince, markSeen };
}
