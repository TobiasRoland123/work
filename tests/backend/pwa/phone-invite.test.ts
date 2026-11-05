import { describe, expect, it } from 'vitest';
import {
  hasSeenPhoneInvite,
  phoneInviteKey,
  rememberPhoneInvite,
  shouldInviteToPhone,
} from '@/components/pwa/phone-invite-storage';

const memory = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
};

describe('phone app invitation', () => {
  it('invites a desktop browser that has not seen it', () => {
    expect(shouldInviteToPhone({ seen: false, standalone: false, desktop: true })).toBe(true);
  });

  it('never invites phones, the installed app, or someone who has already seen it', () => {
    expect(shouldInviteToPhone({ seen: false, standalone: false, desktop: false })).toBe(false);
    expect(shouldInviteToPhone({ seen: false, standalone: true, desktop: true })).toBe(false);
    expect(shouldInviteToPhone({ seen: true, standalone: false, desktop: true })).toBe(false);
  });

  it('is shown once per person in the same browser', () => {
    const storage = memory();
    expect(hasSeenPhoneInvite(storage, 'U1')).toBe(false);
    rememberPhoneInvite(storage, 'U1');
    expect(hasSeenPhoneInvite(storage, 'U1')).toBe(true);
    expect(hasSeenPhoneInvite(storage, 'U2')).toBe(false);
    expect(storage.getItem(phoneInviteKey('U1'))).not.toBeNull();
  });

  it('counts blocked storage as seen so the invitation cannot repeat on every visit', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(hasSeenPhoneInvite(blocked, 'U1')).toBe(true);
    expect(() => rememberPhoneInvite(blocked, 'U1')).not.toThrow();
  });
});
