import { describe, expect, it } from 'vitest';
import { slackText } from '@/lib/slack/text';

describe('Slack message text for display', () => {
  it('shows emoji and characters instead of Slack markup', () => {
    expect(
      slackText('Thursday &amp; Friday from spa. Not WFS, just FS. :grin::tada::wine_glass:')
    ).toBe('Thursday & Friday from spa. Not WFS, just FS. 😁🎉🍷');
  });

  it('decodes every entity Slack escapes, exactly once', () => {
    expect(slackText('a &lt; b &gt; c &amp;lt;')).toBe('a < b > c &lt;');
  });

  it('supports aliases, emoji-style symbols and skin tones', () => {
    expect(slackText(':+1: :thumbsup: :heart: :wave::skin-tone-3:')).toBe('👍 👍 ❤️ 👋🏼');
  });

  it('keeps custom workspace emoji and ordinary colons untouched', () => {
    expect(slackText('Meeting at 10:30: :party-parrot:')).toBe('Meeting at 10:30: :party-parrot:');
  });
});
