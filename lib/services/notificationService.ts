import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import {
  notificationPreferences,
  pinnedColleagues,
  pushSubscriptions,
  status,
  users,
} from '@/db/schema';
import type { Status } from '@/db/types';
import { arrivedInOffice, presentToday } from '@/lib/notifications/arrival';
import { pushConfigured, sendPush } from '@/lib/notifications/push';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_TYPE_IDS,
  type NotificationPreferences,
  type NotificationType,
  type PushPayload,
} from '@/lib/notifications/types';

type Named = { firstName: string | null; lastName: string | null; email: string };

function displayName(person: Named) {
  return (
    [person.firstName, person.lastName].filter(Boolean).join(' ') || person.email.split('@')[0]
  );
}

function listNames(names: string[]) {
  return names.length < 3
    ? names.join(' and ')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Of these people, those who want this type: an explicit choice wins over the default. */
async function optedIn(userIds: string[], type: NotificationType) {
  if (userIds.length === 0) return [];
  const rows = await db
    .select({ userId: notificationPreferences.userId, enabled: notificationPreferences.enabled })
    .from(notificationPreferences)
    .where(
      and(inArray(notificationPreferences.userId, userIds), eq(notificationPreferences.type, type))
    );
  const chosen = new Map(rows.map((row) => [row.userId, row.enabled]));
  return userIds.filter((userId) => chosen.get(userId) ?? DEFAULT_NOTIFICATION_PREFERENCES[type]);
}

/** Send each person's payload to all their devices, forgetting devices that no longer exist. */
async function deliver(payloads: Map<string, PushPayload>) {
  if (payloads.size === 0 || !pushConfigured()) return 0;
  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.userId, [...payloads.keys()]));
  const results = await Promise.all(
    subscriptions.map(async (subscription) => ({
      id: subscription.id,
      result: await sendPush(subscription, payloads.get(subscription.userId)!),
    }))
  );
  const gone = results.filter((entry) => entry.result === 'gone').map((entry) => entry.id);
  if (gone.length > 0)
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
  return results.filter((entry) => entry.result === 'sent').length;
}

export const notificationService = {
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const rows = await db
      .select({ type: notificationPreferences.type, enabled: notificationPreferences.enabled })
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
    const preferences = { ...DEFAULT_NOTIFICATION_PREFERENCES };
    for (const row of rows)
      if ((NOTIFICATION_TYPE_IDS as string[]).includes(row.type))
        preferences[row.type as NotificationType] = row.enabled;
    return preferences;
  },

  async setPreference(userId: string, type: NotificationType, enabled: boolean) {
    await db
      .insert(notificationPreferences)
      .values({ userId, type, enabled })
      .onConflictDoUpdate({
        target: [notificationPreferences.userId, notificationPreferences.type],
        set: { enabled, updatedAt: new Date() },
      });
  },

  /** Saving the same browser twice keeps one row; a browser signed in as someone else moves to them. */
  async subscribe(
    userId: string,
    subscription: { endpoint: string; p256dh: string; auth: string }
  ) {
    await db
      .insert(pushSubscriptions)
      .values({ userId, ...subscription })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId, p256dh: subscription.p256dh, auth: subscription.auth },
      });
  },

  async unsubscribe(userId: string, endpoint: string) {
    await db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
  },

  /**
   * Tell the people who pinned `userId` that they arrived, if the Declarations written since
   * `before` moved them into the office now. Never throws: a failed push must not undo a status.
   */
  async notifyArrival(userId: string, before: readonly Status[], now: Date = new Date()) {
    try {
      if (!pushConfigured()) return 0;
      const after = await db.select().from(status).where(eq(status.userID, userId));
      if (!arrivedInOffice(before, after, userId, now)) return 0;
      const [person] = await db
        .select({ firstName: users.firstName, lastName: users.lastName, email: users.email })
        .from(users)
        .where(and(eq(users.userId, userId), eq(users.slackDeactivated, false)));
      if (!person) return 0;
      const pinners = await db
        .select({ userId: pinnedColleagues.userId })
        .from(pinnedColleagues)
        .innerJoin(users, eq(users.userId, pinnedColleagues.userId))
        .where(
          and(eq(pinnedColleagues.colleagueUserId, userId), eq(users.slackDeactivated, false))
        );
      const recipients = await optedIn(
        pinners.map((pinner) => pinner.userId),
        'pinned_arrived'
      );
      const payload: PushPayload = {
        title: `${displayName(person)} arrived`,
        body: 'Your pinned colleague is in the office.',
        url: '/today',
        tag: `arrived-${userId}`,
      };
      return await deliver(new Map(recipients.map((recipient) => [recipient, payload])));
    } catch (error) {
      console.error('notify_arrival_failed', error);
      return 0;
    }
  },

  /** The morning summary: for each subscribed person, which pinned colleagues are in today. */
  async sendPinnedDigest(now: Date = new Date()) {
    if (!pushConfigured()) return 0;
    const subscribed = await db
      .selectDistinct({ userId: pushSubscriptions.userId })
      .from(pushSubscriptions);
    const recipients = await optedIn(
      subscribed.map((row) => row.userId),
      'pinned_in_today'
    );
    if (recipients.length === 0) return 0;

    const pins = await db
      .select({
        userId: pinnedColleagues.userId,
        colleagueUserId: pinnedColleagues.colleagueUserId,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(pinnedColleagues)
      .innerJoin(users, eq(users.userId, pinnedColleagues.colleagueUserId))
      .where(and(inArray(pinnedColleagues.userId, recipients), eq(users.slackDeactivated, false)));
    if (pins.length === 0) return 0;

    const colleagueIds = [...new Set(pins.map((pin) => pin.colleagueUserId))];
    const statusesByUser = new Map<string, Status[]>(colleagueIds.map((id) => [id, []]));
    for (const row of await db.select().from(status).where(inArray(status.userID, colleagueIds)))
      statusesByUser.get(row.userID)!.push(row);
    const { inOffice, arrivingLater } = presentToday(statusesByUser, now);

    const payloads = new Map<string, PushPayload>();
    for (const recipient of recipients) {
      const own = pins.filter((pin) => pin.userId === recipient);
      const names = (ids: string[]) =>
        own.filter((pin) => ids.includes(pin.colleagueUserId)).map(displayName);
      const here = names(inOffice);
      const later = names(arrivingLater);
      if (here.length + later.length === 0) continue;
      payloads.set(recipient, {
        title: 'Pinned colleagues in today',
        body: [
          here.length > 0 ? `In the office: ${listNames(here)}.` : null,
          later.length > 0 ? `Arriving later: ${listNames(later)}.` : null,
        ]
          .filter(Boolean)
          .join(' '),
        url: '/today',
        tag: 'pinned-in-today',
      });
    }
    return deliver(payloads);
  },
};
