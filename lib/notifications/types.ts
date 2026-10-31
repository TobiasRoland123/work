/** Notification types a person can opt in or out of, independent of which devices are subscribed. */
export const NOTIFICATION_TYPES = [
  {
    id: 'pinned_arrived',
    label: 'Pinned colleague arrived',
    description: 'When a pinned colleague is announced as in the office.',
  },
  {
    id: 'pinned_in_today',
    label: 'Pinned colleagues in today',
    description: 'A morning summary of which pinned colleagues are in the office.',
  },
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]['id'];

export const NOTIFICATION_TYPE_IDS = NOTIFICATION_TYPES.map((type) => type.id) as [
  NotificationType,
  ...NotificationType[],
];

/** What a person gets for a type they never changed. */
export const DEFAULT_NOTIFICATION_PREFERENCES: Record<NotificationType, boolean> = {
  pinned_arrived: true,
  pinned_in_today: true,
};

export type NotificationPreferences = Record<NotificationType, boolean>;

export type PushPayload = {
  title: string;
  body: string;
  /** Page to open when the notification is clicked. */
  url: string;
  /** A newer notification with the same tag replaces the older one. */
  tag: string;
};
