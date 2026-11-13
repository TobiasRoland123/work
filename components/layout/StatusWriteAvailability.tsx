'use client';

import React, { createContext, useContext, type ReactNode } from 'react';

const StatusWriteAvailability = createContext(true);
export function StatusWriteAvailabilityProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  return (
    <StatusWriteAvailability.Provider value={enabled}>{children}</StatusWriteAvailability.Provider>
  );
}
export function useStatusWritesEnabled() {
  return useContext(StatusWriteAvailability);
}
