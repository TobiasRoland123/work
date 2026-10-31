import webpush from 'web-push';
import type { PushPayload } from './types';

export type PushTarget = { endpoint: string; p256dh: string; auth: string };

/** Push needs a VAPID key pair; without one the feature is off and nothing is sent. */
export function pushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() &&
      process.env.VAPID_PRIVATE_KEY?.trim() &&
      process.env.VAPID_SUBJECT?.trim()
  );
}

/** `gone` means the browser dropped the subscription, so it should be forgotten. */
export async function sendPush(
  target: PushTarget,
  payload: PushPayload
): Promise<'sent' | 'gone' | 'failed'> {
  if (!pushConfigured()) return 'failed';
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(payload),
      {
        TTL: 60 * 60,
        vapidDetails: {
          subject: process.env.VAPID_SUBJECT!.trim(),
          publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.trim(),
          privateKey: process.env.VAPID_PRIVATE_KEY!.trim(),
        },
      }
    );
    return 'sent';
  } catch (error) {
    const code = (error as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) return 'gone';
    console.error('push_failed', { statusCode: code });
    return 'failed';
  }
}
