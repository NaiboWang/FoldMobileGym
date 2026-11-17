import React, { useEffect, useRef } from 'react';
import { useAppStrings } from '@/os/useAppStrings';
import { useSmsGestures } from '../hooks/useSmsGestures';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

export function ComposeRecipientErrorDialog() {
  const s = useAppStrings(strings, stringsEn);
  const { bindBack, back } = useSmsGestures();
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    button.current?.focus();
    return () => { queueMicrotask(() => { if (previous?.isConnected && !previous.closest('[inert]')) previous.focus(); }); };
  }, []);
  return <div className="sms-compose-error-backdrop">
    <section role="alertdialog" aria-modal="true" aria-labelledby="sms-compose-error-title" aria-describedby="sms-compose-error-description"
      className="sms-compose-error-dialog" data-scroll-container="dialog" data-scroll-direction="vertical"
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); back(); }
        if (event.key === 'Tab') { event.preventDefault(); button.current?.focus(); }
      }}>
      <h2 id="sms-compose-error-title">{s.error_invalid_recipient_title}</h2>
      <p id="sms-compose-error-description">{s.error_invalid_recipient_body}</p>
      <button type="button" ref={button} {...bindBack()}>{s.error_invalid_recipient_ok}</button>
    </section>
  </div>;
}
