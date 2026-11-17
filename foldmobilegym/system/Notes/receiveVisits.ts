import { createContext, useContext } from 'react';

/** Tracks incoming shares for the lifetime of their owning Notes Activity. */
export const ReceiveVisitsContext = createContext<Set<string> | null>(null);
export function useReceiveVisits(): Set<string> {
  const visits = useContext(ReceiveVisitsContext);
  if (!visits) throw new Error('Notes receive visits provider is missing');
  return visits;
}
