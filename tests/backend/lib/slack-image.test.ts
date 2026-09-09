import { describe, expect, it } from 'vitest';
import { getSlackImageUrl } from '@/lib/slack/image';

const photo = 'https://avatars.slack-edge.com/team-user.jpg';
describe('Slack-only profile photos', () => {
  it.each([
    photo,
    'https://secure.gravatar.com/avatar/user.png',
    'https://a.slack-edge.com/default-user.png',
  ])('accepts a Slack photo source: %s', (url) => {
    expect(getSlackImageUrl(url)).toBe(url);
  });

  it.each([
    null,
    undefined,
    '',
    'invalid',
    'https://hel1.your-objectstorage.com/workbucket/profile-images/old.webp',
    'https://avatars.slack-edge.com.attacker.example/photo.jpg',
    'http://avatars.slack-edge.com/photo.jpg',
    'https://user:password@avatars.slack-edge.com/photo.jpg',
    'https://avatars.slack-edge.com:8443/photo.jpg',
  ])('uses the initials fallback for an unsupported source: %s', (url) => {
    expect(getSlackImageUrl(url)).toBeNull();
  });
});
