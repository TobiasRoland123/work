'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Home, Users, UserRound, Pause, Play, RotateCcw, ZoomIn, ZoomOut, X } from 'lucide-react';
import type { UserWithExtras } from '@/db/types';
import { StatusForm } from '@/components/StatusForm/StatusForm';
import { PeoplePanel, personName, isInOffice } from './PeoplePanel';
import './office.css';

const OfficeScene = dynamic(() => import('@/components/office-scene/OfficeScene'), {
  ssr: false,
  loading: () => (
    <div className="office-loading" role="status">
      Loading the office...
    </div>
  ),
});

function subscribeMotion(callback: () => void) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', callback);
  document.addEventListener('visibilitychange', callback);
  return () => {
    media.removeEventListener('change', callback);
    document.removeEventListener('visibilitychange', callback);
  };
}
const canAnimate = () =>
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
  document.visibilityState === 'visible';
const serverMotion = () => false;

export function OfficeDashboard({
  profiles,
  userId,
  dateLabel,
  arrival,
  syncError,
  onStatusSaved,
}: {
  profiles: UserWithExtras[];
  userId: string;
  dateLabel: string;
  arrival: string | null;
  syncError: boolean;
  onStatusSaved: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [topDown, setTopDown] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [reset, setReset] = useState(0);
  const [paused, setPaused] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [step, setStep] = useState(1);
  const motion = useSyncExternalStore(subscribeMotion, canAnimate, serverMotion);
  const present = profiles
    .filter(isInOffice)
    .map((person) => ({ id: person.userId, name: personName(person) }));
  const me = profiles.find((person) => person.userId === userId);
  const selectPerson = (id: string | null) => setSelectedId(id);
  function openStatus(open: boolean) {
    setStatusOpen(open);
    setStep(1);
  }
  return (
    <div className="office-dashboard">
      <nav className="office-rail" aria-label="App navigation">
        <Link href="/today" className="office-wordmark" aria-label="WØRK home">
          WØRK
        </Link>
        <div className="office-nav-links">
          <Link href="/today" aria-current="page">
            <Home size={21} />
            Today
          </Link>
          <Link href="/contact">
            <Users size={21} />
            Contact
          </Link>
          <Link href="/profile">
            <UserRound size={21} />
            Profile
          </Link>
        </div>
        <Link href="/profile" className="office-me">
          <span>{me?.firstName?.[0] || 'W'}</span>
          <small>{me?.firstName || 'My profile'}</small>
        </Link>
      </nav>
      <main className="office-workspace" id="dashboard-main">
        <header className="office-header">
          <div>
            <h1>Today</h1>
            <p>Copenhagen studio</p>
          </div>
          <div className="office-header-actions">
            <time>{dateLabel}</time>
            <button className="set-status-button" onClick={() => openStatus(true)}>
              Set my status
            </button>
          </div>
        </header>
        <section className="office-map" aria-label="Office presence map">
          <OfficeScene
            people={present}
            selectedId={selectedId}
            onSelect={selectPerson}
            topDown={topDown}
            zoom={zoom}
            reset={reset}
            animate={motion && !paused}
          />
          <div className="office-presence-pill">
            <span className="presence-dot" />
            <strong>{present.length} in office</strong>
            <span>{syncError ? 'Reconnecting...' : 'Today’s presence'}</span>
          </div>
          <div className="office-map-footer">
            <div>
              <p>COPENHAGEN STUDIO</p>
              <small>Floor 1 · Characters illustrate presence, not location</small>
            </div>
            <div className="office-map-controls" aria-label="Office view controls">
              <button aria-pressed={!topDown} onClick={() => setTopDown(false)}>
                3D
              </button>
              <button aria-pressed={topDown} onClick={() => setTopDown(true)}>
                Top view
              </button>
              <span className="control-divider" />
              <button
                onClick={() => setZoom((value) => Math.min(2, value + 0.15))}
                aria-label="Zoom in"
                disabled={zoom >= 2}
              >
                <ZoomIn size={20} />
              </button>
              <button
                onClick={() => setZoom((value) => Math.max(0.55, value - 0.15))}
                aria-label="Zoom out"
                disabled={zoom <= 0.55}
              >
                <ZoomOut size={20} />
              </button>
              <button
                onClick={() => {
                  setZoom(1);
                  setTopDown(false);
                  setReset((value) => value + 1);
                }}
                aria-label="Reset office view"
              >
                <RotateCcw size={19} />
              </button>
              <button
                onClick={() => setPaused((value) => !value)}
                aria-label={paused ? 'Play office animation' : 'Pause office animation'}
                disabled={!motion}
              >
                {paused || !motion ? <Play size={18} /> : <Pause size={18} />}
              </button>
            </div>
          </div>
          {arrival && (
            <div className="office-arrival" role="status">
              <span className="presence-dot" />
              {arrival}
            </div>
          )}
        </section>
      </main>
      <PeoplePanel profiles={profiles} selectedId={selectedId} onSelect={selectPerson} />
      <Dialog.Root open={statusOpen} onOpenChange={openStatus}>
        <Dialog.Portal>
          <Dialog.Overlay className="office-dialog-overlay" />
          <Dialog.Content className="office-status-dialog">
            <Dialog.Title className="sr-only">Set my status</Dialog.Title>
            <Dialog.Description className="sr-only">
              Tell your colleagues where you are working today.
            </Dialog.Description>
            <StatusForm
              key={statusOpen ? 'open' : 'closed'}
              userId={userId}
              currentStep={step}
              setCurrentStep={setStep}
              setOpenDrawer={(open) => {
                openStatus(open);
                if (!open) onStatusSaved();
              }}
              closeButton={
                <Dialog.Close aria-label="Close status form">
                  <X size={22} />
                </Dialog.Close>
              }
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
