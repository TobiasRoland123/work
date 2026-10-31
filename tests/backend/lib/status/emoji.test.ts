import { describe, expect, it } from 'vitest';
import { defaultStatusEmoji, statusEmoji } from '@/lib/status/emoji';

describe('automatic declaration emoji', () => {
  it('has a default for every attendance status and none for description-only declarations', () => {
    for (const [status, emoji] of Object.entries(defaultStatusEmoji)) {
      expect(statusEmoji(status as keyof typeof defaultStatusEmoji)).toBe(emoji);
    }
    expect(statusEmoji(null, '🌴')).toBeNull();
  });

  it('keeps the first relevant emoji, rather than unrelated greetings or reactions', () => {
    expect(statusEmoji('VACATION', '👋 Vacation today and tomorrow 🌴 ☀️')).toBe('🌴');
    expect(statusEmoji('FROM_HOME', '🎉 Working from home 🏡')).toBe('🏡');
    expect(statusEmoji('SICK', 'Home today 🤧')).toBe('🤧');
    expect(statusEmoji('FROM_HOME', 'Working from home 🌴')).toBe('🏠');
  });

  it('preserves full graphemes and variation selectors and skips unsupported composites', () => {
    expect(statusEmoji('VACATION', 'Vacation 🏖️')).toBe('🏖️');
    expect(statusEmoji('VACATION', 'Vacation ☀')).toBe('☀');
    expect(statusEmoji('AWAY', 'Walking 🚶🏽‍♀️')).toBe('🚶');
    expect(statusEmoji('CHILD_SICK', 'Home with child 👶🏽')).toBe('👶🏽');
    expect(statusEmoji('LEAVING_EARLY', 'Heading home 👋🏽')).toBe('👋🏽');
  });

  it('resolves known Slack emoji in message order and ignores custom emoji', () => {
    expect(statusEmoji('VACATION', ':tada: Vacation :desert_island: 🌴')).toBe('🏝️');
    expect(statusEmoji('VACATION', 'Vacation 🌴 :desert_island:')).toBe('🌴');
    expect(statusEmoji('FROM_HOME', ':house_with_garden: WFH')).toBe('🏡');
    expect(statusEmoji('FROM_HOME', ':company_house: WFH :tada:')).toBe('🏠');
    expect(statusEmoji('FROM_HOME', ':palm_tree: WFH')).toBe('🏠');
    expect(statusEmoji('ON_LEAVE', ':seedling: On leave')).toBe('🌱');
  });

  it('selects separately for each status in a multi-interval declaration', () => {
    const message = 'Home 🏡 today and vacation 🏖️ tomorrow';
    expect(statusEmoji('FROM_HOME', message)).toBe('🏡');
    expect(statusEmoji('VACATION', message)).toBe('🏖️');
    expect(statusEmoji('IN_OFFICE', message)).toBe('🏢');
  });
});
