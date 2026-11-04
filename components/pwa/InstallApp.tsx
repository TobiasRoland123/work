'use client';

import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Download, X } from 'lucide-react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function useInstallController() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)');
    const isStandalone = () =>
      standalone.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(isStandalone());
    setIos(
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );
    const beforeInstall = (event: Event) => {
      if (isStandalone()) return;
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const appInstalled = () => {
      setInstalled(true);
      setPrompt(null);
      setInstructionsOpen(false);
    };
    const displayChanged = () => setInstalled(isStandalone());
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', appInstalled);
    standalone.addEventListener('change', displayChanged);
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', appInstalled);
      standalone.removeEventListener('change', displayChanged);
    };
  }, []);

  async function install() {
    if (installed) return;
    if (!prompt) {
      if (ios) {
        setError(false);
        setInstructionsOpen(true);
      }
      return;
    }
    // A browser install event can only be used once, including after dismissal.
    setPrompt(null);
    try {
      const result = await prompt.prompt();
      if (result.outcome === 'accepted') setInstalled(true);
    } catch {
      setError(true);
      setInstructionsOpen(true);
    }
  }

  return {
    available: !installed && (Boolean(prompt) || ios),
    install,
    instructionsOpen,
    setInstructionsOpen,
    error,
  };
}

const InstallAppContext = createContext<ReturnType<typeof useInstallController> | null>(null);

export function InstallAppProvider({ children }: { children: ReactNode }) {
  const installer = useInstallController();
  return <InstallAppContext.Provider value={installer}>{children}</InstallAppContext.Provider>;
}

export function useInstallApp() {
  const installer = useContext(InstallAppContext);
  if (!installer) throw new Error('InstallAppProvider must wrap the app');
  return installer;
}

export function InstallApp({
  installer,
  onInstall,
  onClose,
}: {
  installer: ReturnType<typeof useInstallApp>;
  onInstall: () => void;
  onClose: () => void;
}) {
  return (
    <>
      {installer.available && (
        <button
          type="button"
          className="office-install-app"
          onClick={() => {
            onInstall();
            void installer.install();
          }}
        >
          <Download size={21} aria-hidden="true" />
          Install WØRK
        </button>
      )}
      <Dialog.Root open={installer.instructionsOpen} onOpenChange={installer.setInstructionsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="office-dialog-overlay" />
          <Dialog.Content
            className="office-install-dialog"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              onClose();
            }}
          >
            <Dialog.Title>Install WØRK</Dialog.Title>
            <Dialog.Description>
              {installer.error
                ? 'The install prompt could not open. You can try installing WØRK from your browser menu instead.'
                : 'Keep WØRK on your Home Screen and open it in its own app window.'}
            </Dialog.Description>
            {!installer.error && (
              <ol>
                <li>Open the browser&apos;s Share menu.</li>
                <li>Choose Add to Home Screen. You may need to tap More to find it.</li>
                <li>If shown, keep Open as Web App enabled, then tap Add.</li>
              </ol>
            )}
            <Dialog.Close className="office-install-done">Got it</Dialog.Close>
            <Dialog.Close className="office-install-close" aria-label="Close install instructions">
              <X size={20} aria-hidden="true" />
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
