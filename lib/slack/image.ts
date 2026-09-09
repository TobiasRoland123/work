const slackImageHosts = ['avatars.slack-edge.com', 'secure.gravatar.com', 'a.slack-edge.com'];

export function getSlackImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      slackImageHosts.includes(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
