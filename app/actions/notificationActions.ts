'use server';
import { z } from 'zod';
import { requireUserId } from '@/lib/auth/require-user';
import { notificationService } from '@/lib/services/notificationService';
import { NOTIFICATION_TYPE_IDS } from '@/lib/notifications/types';

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048).startsWith('https://'),
  keys: z.object({ p256dh: z.string().min(1).max(256), auth: z.string().min(1).max(256) }),
});

export async function subscribePushAction(input: unknown) {
  const userId = await requireUserId();
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false as const, error: 'This browser sent an invalid subscription.' };
  try {
    await notificationService.subscribe(userId, {
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    });
    return { ok: true as const };
  } catch (error) {
    console.error(error);
    return { ok: false as const, error: 'Something went wrong, notifications were not turned on.' };
  }
}

export async function unsubscribePushAction(endpoint: string) {
  const userId = await requireUserId();
  try {
    await notificationService.unsubscribe(userId, String(endpoint));
    return { ok: true as const };
  } catch (error) {
    console.error(error);
    return {
      ok: false as const,
      error: 'Something went wrong, notifications were not turned off.',
    };
  }
}

export async function setNotificationPreferenceAction(type: string, enabled: boolean) {
  const userId = await requireUserId();
  const parsed = z.object({ type: z.enum(NOTIFICATION_TYPE_IDS), enabled: z.boolean() }).safeParse({
    type,
    enabled,
  });
  if (!parsed.success) return { ok: false as const, error: 'Unknown notification type.' };
  try {
    await notificationService.setPreference(userId, parsed.data.type, parsed.data.enabled);
    return { ok: true as const };
  } catch (error) {
    console.error(error);
    return { ok: false as const, error: 'Something went wrong, your choice was not saved.' };
  }
}
