import type { UserStatus } from '@/db/types';

/** Defaults also cover manual declarations and declarations saved before emoji selection. */
export const defaultStatusEmoji: Record<UserStatus, string> = {
  IN_OFFICE: '🏢',
  FROM_HOME: '🏠',
  REMOTE: '💻',
  AT_CLIENT: '💼',
  SICK: '🤒',
  IN_LATE: '🕒',
  LEAVING_EARLY: '🚪',
  VACATION: '🌴',
  CHILD_SICK: '🧸',
  ON_LEAVE: '🌿',
  AWAY: '🚶',
};

const relevantEmoji: Record<UserStatus, readonly string[]> = {
  IN_OFFICE: ['🏢', '🏬'],
  FROM_HOME: ['🏠', '🏡'],
  REMOTE: ['💻', '🌍', '🌎', '🌏'],
  AT_CLIENT: ['💼', '🤝'],
  SICK: ['🤒', '🤧', '😷', '🤕'],
  IN_LATE: ['🕒', '⏰', '⌛', '⏳'],
  LEAVING_EARLY: ['🚪', '👋'],
  VACATION: ['🌴', '🏖', '🏝', '☀', '😎', '🧳', '✈'],
  CHILD_SICK: ['🧸', '🤒', '🤧', '😷', '👶'],
  ON_LEAVE: ['🌿', '🌱', '👶', '🍼'],
  AWAY: ['🚶', '🚗', '🚆', '✈'],
};

// Only known standard Slack names are interpreted; custom workspace emoji stay untouched.
const slackEmoji: Record<string, string> = {
  office: '🏢',
  department_store: '🏬',
  house: '🏠',
  house_with_garden: '🏡',
  computer: '💻',
  globe_with_meridians: '🌐',
  earth_africa: '🌍',
  earth_americas: '🌎',
  earth_asia: '🌏',
  briefcase: '💼',
  handshake: '🤝',
  face_with_thermometer: '🤒',
  sneezing_face: '🤧',
  mask: '😷',
  face_with_head_bandage: '🤕',
  clock3: '🕒',
  alarm_clock: '⏰',
  hourglass: '⌛',
  hourglass_flowing_sand: '⏳',
  door: '🚪',
  wave: '👋',
  palm_tree: '🌴',
  beach_with_umbrella: '🏖️',
  desert_island: '🏝️',
  sunny: '☀️',
  sunglasses: '😎',
  luggage: '🧳',
  airplane: '✈️',
  teddy_bear: '🧸',
  baby: '👶',
  seedling: '🌱',
  herb: '🌿',
  baby_bottle: '🍼',
  walking: '🚶',
  car: '🚗',
  red_car: '🚗',
  train2: '🚆',
};

const graphemes = new Intl.Segmenter('en', { granularity: 'grapheme' });
const normalize = (emoji: string) => emoji.replace(/[\uFE0F\u{1F3FB}-\u{1F3FF}]/gu, '');

/** Reuse the first clearly relevant message emoji, otherwise use the status default. */
export function statusEmoji(status: UserStatus | null, text?: string | null): string | null {
  if (!status) return null;
  if (text) {
    const candidates = [
      ...Array.from(graphemes.segment(text), ({ segment, index }) => ({ emoji: segment, index })),
      ...Array.from(text.matchAll(/:([a-z0-9_+-]+):/g), (match) => ({
        emoji: slackEmoji[match[1]] ?? '',
        index: match.index,
      })),
    ].sort((a, b) => a.index - b.index);
    const relevant = candidates.find(({ emoji }) =>
      relevantEmoji[status].includes(normalize(emoji))
    );
    if (relevant) return relevant.emoji;
  }
  return defaultStatusEmoji[status];
}
