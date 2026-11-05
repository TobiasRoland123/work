import iamcal from 'emojibase-data/en/shortcodes/iamcal.json';

// Slack names its standard emoji after iamcal/emoji-data, so this covers what Slack sends as `:name:`.
const emojiByName = new Map<string, string>();
for (const [hexcode, names] of Object.entries(iamcal)) {
  const codepoints = hexcode.split('-').map((hex) => parseInt(hex, 16));
  // Bare symbols such as ❤ or ☀ default to text style; ask for the emoji glyph instead.
  if (codepoints.length === 1 && codepoints[0] < 0x1f000) codepoints.push(0xfe0f);
  const emoji = String.fromCodePoint(...codepoints);
  for (const name of [names].flat()) emojiByName.set(name, emoji);
}

const skinTone = (tone: string) => String.fromCodePoint(0x1f3fb + Number(tone) - 2);

/**
 * Turn Slack's message markup into readable text: HTML entities become characters and standard
 * `:shortcode:` emoji (with optional `::skin-tone-N:`) become the emoji itself. Custom workspace
 * emoji have no Unicode form, so they keep their shortcode.
 */
export function slackText(text: string): string {
  return text
    .replace(/:([a-z0-9_+'-]+):(?::skin-tone-([2-6]):)?/g, (match, name: string, tone?: string) => {
      const emoji = emojiByName.get(name);
      if (!emoji) return match;
      return tone ? emoji.replace('️', '') + skinTone(tone) : emoji;
    })
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}
