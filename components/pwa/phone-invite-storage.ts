// The phone-app invitation is offered once per person in each browser, like the Palette and
// the Week page's last look: remembered locally rather than per account.
export const phoneInviteKey = (userId: string) => `phone-app-invite:${userId}`;

/**
 * Whether to invite someone to try WØRK on their phone. Only for a desktop-sized browser
 * window with a precise pointer, because scanning a QR code needs a second device. Never
 * inside the installed app, and never again once it has been shown.
 */
export function shouldInviteToPhone({
  seen,
  standalone,
  desktop,
}: {
  seen: boolean;
  standalone: boolean;
  desktop: boolean;
}) {
  return desktop && !standalone && !seen;
}

export function hasSeenPhoneInvite(storage: Pick<Storage, 'getItem'>, userId: string) {
  try {
    return storage.getItem(phoneInviteKey(userId)) !== null;
  } catch {
    // Storage blocked: treat it as seen, so the invitation never repeats on every page load.
    return true;
  }
}

export function rememberPhoneInvite(storage: Pick<Storage, 'setItem'>, userId: string) {
  try {
    storage.setItem(phoneInviteKey(userId), new Date().toISOString());
  } catch {
    // Private browsing or a full quota: nothing more to do.
  }
}
