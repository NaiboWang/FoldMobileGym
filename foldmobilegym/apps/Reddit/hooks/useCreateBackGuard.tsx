import React, { createContext, useContext, useRef } from 'react';
const Context = createContext<React.MutableRefObject<(() => boolean) | null> | null>(null);
/** Activity-local editor guard; the app navigation handler still owns system Back. */
export function CreateBackGuardProvider({children}: {children: React.ReactNode}) {
  const guard = useRef<(() => boolean) | null>(null);
  return <Context.Provider value={guard}>{children}</Context.Provider>;
}
export function useCreateBackGuard() {
  const value = useContext(Context);
  if (!value) throw new Error('CreateBackGuardProvider is required');
  return value;
}
