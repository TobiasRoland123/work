'use client';

import dynamic from 'next/dynamic';
import { useState, useSyncExternalStore } from 'react';
import { Pause, Play, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import type { UserWithExtras } from '@/db/types';
import { PageHeader } from '@/components/layout/PageHeader';
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
  const motion = useSyncExternalStore(subscribeMotion, canAnimate, serverMotion);
  const present = profiles
    .filter(isInOffice)
    .map((person) => ({ id: person.userId, name: personName(person) }));
  const selectPerson = (id: string | null) => setSelectedId(id);
  return (
    <div className="office-dashboard">
      <main className="office-workspace" id="dashboard-main">
        <PageHeader
          title="Today"
          subtitle="Copenhagen studio"
          userId={userId}
          dateLabel={dateLabel}
          onStatusSaved={onStatusSaved}
        />
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
    </div>
  );
}
