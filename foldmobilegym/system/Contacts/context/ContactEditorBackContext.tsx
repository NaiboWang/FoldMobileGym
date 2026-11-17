import React, { createContext, useContext, useRef } from 'react';
export type ContactEditorBackHandler = () => boolean;
const ContactEditorBackContext = createContext<React.MutableRefObject<ContactEditorBackHandler | null> | null>(null);
export function ContactEditorBackProvider({ children }: { children: React.ReactNode }) {
  const handler = useRef<ContactEditorBackHandler | null>(null);
  return <ContactEditorBackContext.Provider value={handler}>{children}</ContactEditorBackContext.Provider>;
}
export function useContactEditorBack() {
  const handler = useContext(ContactEditorBackContext);
  if (!handler) throw new Error('Contact editor back provider is missing');
  return handler;
}
