'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  setNotificationPreferenceAction,
  subscribePushAction,
  unsubscribePushAction,
} from '@/app/actions/notificationActions';
import {
  NOTIFICATION_TYPES,
  type NotificationPreferences,
  type NotificationType,
} from '@/lib/notifications/types';
import './profile-settings.css';

type DeviceState = 'checking' | 'unsupported' | 'blocked' | 'off' | 'on';

type Props = {
  /** The VAPID public key; empty when the server has no push keys, which turns the feature off. */
  vapidPublicKey: string;
  initialPreferences: NotificationPreferences;
};

function applicationServerKey(base64Url: string) {
  const padded = base64Url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(base64Url.length / 4) * 4, '=');
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** Push notifications: turn them on for this device, and choose which kinds to receive. */
export function NotificationSettings({ vapidPublicKey, initialPreferences }: Props) {
  const [device, setDevice] = useState<DeviceState>('checking');
  const [preferences, setPreferences] = useState(initialPreferences);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    if (!pushSupported()) return setDevice('unsupported');
    if (Notification.permission === 'denied') return setDevice('blocked');
    const registration = await navigator.serviceWorker.ready;
    setDevice((await registration.pushManager.getSubscription()) ? 'on' : 'off');
  }, []);

  useEffect(() => {
    // Browser capabilities are only known after mounting.
    void refresh();
  }, [refresh]);

  const turnOn = () =>
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return void (await refresh());
        const registration = await navigator.serviceWorker.ready;
        const subscription =
          (await registration.pushManager.getSubscription()) ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey(vapidPublicKey),
          }));
        const result = await subscribePushAction(subscription.toJSON());
        if (!result.ok) {
          await subscription.unsubscribe();
          toast(result.error);
        }
      } catch (error) {
        console.error(error);
        toast('Could not turn on notifications on this device 🚫');
      }
      await refresh();
    });

  const turnOff = () =>
    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await unsubscribePushAction(subscription.endpoint);
          await subscription.unsubscribe();
        }
      } catch (error) {
        console.error(error);
        toast('Could not turn off notifications on this device 🚫');
      }
      await refresh();
    });

  const choose = (type: NotificationType, enabled: boolean) => {
    setPreferences((current) => ({ ...current, [type]: enabled }));
    startTransition(async () => {
      const result = await setNotificationPreferenceAction(type, enabled);
      if (!result.ok) {
        setPreferences((current) => ({ ...current, [type]: !enabled }));
        toast(result.error);
      }
    });
  };

  const configured = vapidPublicKey !== '';
  const hint = !configured
    ? 'Notifications are not set up on this server yet.'
    : device === 'unsupported'
      ? 'This browser cannot show notifications. On iPhone and iPad, add WØRK to the Home Screen first, then open it from there.'
      : device === 'blocked'
        ? 'Notifications are blocked for this site. Allow them in your browser settings, then come back.'
        : device === 'on'
          ? 'This device receives the notifications you choose below.'
          : 'Notifications are off on this device. Your choices below apply to all your devices.';

  return (
    <section className="profile-settings" aria-labelledby="notification-settings-heading">
      <div className="profile-settings__heading">
        <span>Settings</span>
        <h2 id="notification-settings-heading">Notifications</h2>
      </div>

      <fieldset className="profile-settings__group">
        <legend>This device</legend>
        <p className="profile-settings__hint">{hint}</p>
        {configured && (device === 'off' || device === 'on') && (
          <button
            type="button"
            className="settings-action"
            disabled={pending}
            onClick={device === 'on' ? turnOff : turnOn}
          >
            {device === 'on' ? 'Turn off for this device' : 'Turn on for this device'}
          </button>
        )}
      </fieldset>

      <fieldset className="profile-settings__group">
        <legend>Send me</legend>
        <div className="profile-settings__toggles">
          {NOTIFICATION_TYPES.map(({ id, label, description }) => (
            <label className="settings-toggle" key={id}>
              <input
                type="checkbox"
                checked={preferences[id]}
                onChange={(event) => choose(id, event.target.checked)}
              />
              <span className="settings-toggle__text">
                {label}
                <small>{description}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  );
}
