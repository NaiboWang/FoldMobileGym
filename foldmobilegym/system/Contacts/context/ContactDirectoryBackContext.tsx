import React, { createContext, useContext, useRef } from 'react';

type DirectoryBackHandler = () => boolean;
const Context = createContext<React.MutableRefObject<DirectoryBackHandler | null> | null>(null);

export function ContactDirectoryBackProvider({ children }: { children: React.ReactNode }) {
  const handler = useRef<DirectoryBackHandler | null>(null);
  return <Context.Provider value={handler}>{children}</Context.Provider>;
}

export function useContactDirectoryBack() {
  const handler = useContext(Context);
  if (!handler) throw new Error('Contact directory back provider is missing');
  return handler;
}
