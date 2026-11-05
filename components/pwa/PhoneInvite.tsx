'use client';

import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Smartphone, X } from 'lucide-react';
import { dismissPhoneInviteAction } from '@/app/actions/phoneInviteActions';

const DESKTOP = '(min-width: 768px) and (pointer: fine)';

/**
 * Invites a desktop user to open WØRK on their phone and install it. Rendered only until the
 * person has closed it once; closing it records that on their account. Phone-sized screens and
 * the installed app never show it, since a QR code needs a second device.
 */
export function PhoneInvite() {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    if (standalone || !window.matchMedia(DESKTOP).matches) return;

    let cancelled = false;
    // Loaded only for the few visits that show the invitation.
    void import('qrcode')
      .then(({ toString }) =>
        toString(new URL('/today', window.location.origin).href, {
          type: 'svg',
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#090b0c', light: '#ffffff' },
        })
      )
      .then((svg) => {
        if (cancelled) return;
        setQrCode(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
        setOpen(true);
      })
      .catch(() => {
        // Without a QR code there is nothing to show; try again on a later visit.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function changeOpen(value: boolean) {
    setOpen(value);
    // Closing it any way counts. If saving fails, it is offered again on a later visit.
    if (!value) void dismissPhoneInviteAction();
  }

  if (!qrCode) return null;

  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="office-dialog-overlay" />
        <Dialog.Content className="office-install-dialog office-phone-invite">
          <Smartphone className="office-phone-invite-icon" size={28} aria-hidden="true" />
          <Dialog.Title>Take WØRK with you</Dialog.Title>
          <Dialog.Description>
            Scan the code with your phone&apos;s camera, then add WØRK to your Home Screen. It opens
            like an app, so checking who is in the office takes a tap.
          </Dialog.Description>
          {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
          <img
            className="office-phone-invite-qr"
            src={qrCode}
            width={200}
            height={200}
            alt="QR code that opens WØRK on your phone"
          />
          <ol>
            <li>Point your phone&apos;s camera at the code and open the link.</li>
            <li>
              iPhone: tap Share, then Add to Home Screen. Android: tap Install app when Chrome
              offers it.
            </li>
          </ol>
          <Dialog.Close className="office-install-done">Got it</Dialog.Close>
          <Dialog.Close className="office-install-close" aria-label="Close phone app invitation">
            <X size={20} aria-hidden="true" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
