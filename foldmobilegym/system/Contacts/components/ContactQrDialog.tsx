import React, { useContext, useEffect, useRef, useState } from 'react';
import { UNSAFE_NavigationContext, useLocation } from 'react-router-dom';
import QRCode from 'qrcode';
import { useActivityId } from '@/os/ActivityContext';
import { useAppStrings } from '@/os/useAppStrings';
import { useContactsGestures } from '../hooks/useContactsGestures';
import { useContactDetailOwner } from '../hooks/useContactDetailOwner';
import { contactSourceIsCurrent } from '../state';
import type { Contact } from '../types';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { primaryContactPhone } from '../utils/contactPhone';
import { contactQrBackFallback } from '../utils/qrBack';

/** Local contact QR; the source detail stays inert until this dialog closes. */
export function ContactQrDialog({ contact, returnFocus }: { contact: Contact; returnFocus?: HTMLElement | null }) {
  const s = useAppStrings(strings, stringsEn);
  const { closeQr } = useContactsGestures();
  const ownsQr = useContactDetailOwner(contact, { modal: 'qr' });
  const closeRef = useRef<HTMLButtonElement>(null);
  const source = useRef(contact).current;
  const activityId = useActivityId();
  const location = useLocation(), { navigator } = useContext(UNSAFE_NavigationContext);
  const [result, setResult] = useState<{ key: string; url: string | null } | null>(null);
  const phone = primaryContactPhone(contact.phones ?? []);
  const key = JSON.stringify([contact.id, contact.displayName, phone]);

  useEffect(() => {
    let current = true;
    const value = `MECARD:N:${contact.displayName};TEL:${phone};;`;
    void QRCode.toDataURL(value, { margin: 1, width: 240 }).then(
      url => { if (current) setResult({ key, url }); },
      () => { if (current) setResult({ key, url: null }); },
    );
    return () => { current = false; };
  }, [contact, key, phone]);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    return () => { queueMicrotask(() => {
      const os = window.__OS__?.getState(), top = os?.tasks.find(task => task.taskId === os.activeTaskId)?.stack.at(-1);
      const current = (navigator as { location?: typeof location }).location;
      const ownParent = current && contactQrBackFallback(location.pathname, location.search, current) === null;
      if (!os?.isLauncherVisible && !os?.isRecentsVisible && top?.activityId === activityId
        && ownParent && contactSourceIsCurrent(source) && returnFocus?.isConnected && !returnFocus.closest('[inert]')
        && returnFocus.closest('[data-benchmark-source-id]')?.getAttribute('data-benchmark-source-id') === source.id) {
        returnFocus.focus({ preventScroll: true });
      }
    }); };
  }, [activityId, location.pathname, location.search, navigator, returnFocus, source]);

  const close = () => { if (ownsQr()) closeQr(); };
  return <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/45 px-6">
    <button type="button" tabIndex={-1} className="absolute inset-0" aria-label={s.contact_qr_close} onClick={close} />
    <section role="dialog" aria-modal="true" aria-label={s.contact_qr_title}
      className="relative z-10 max-h-full w-full max-w-[320px] overflow-y-auto rounded-3xl bg-app-surface p-6 text-center shadow-2xl"
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
        if (event.key === 'Tab') { event.preventDefault(); closeRef.current?.focus(); }
      }}>
      <h2 className="text-lg font-semibold text-app-text">{s.contact_qr_title}</h2>
      <p className="mt-2 text-sm text-gray-500">{s.contact_qr_hint}</p>
      {result?.key === key && result.url ? <img src={result.url} alt={s.contact_qr_title} style={{ maxWidth: 240 }} className="mx-auto mt-5 h-auto w-full" /> : result?.key === key ? <p role="alert" className="mt-5 text-sm text-app-text">{s.contact_qr_error}</p> : <div style={{ maxWidth: 240 }} className="mx-auto mt-5 aspect-square w-full rounded-xl bg-gray-100 animate-pulse" />}
      <button ref={closeRef} type="button" className="mt-5 w-full rounded-2xl bg-gray-100 py-3 text-app-text" onClick={close}>{s.contact_qr_close}</button>
    </section>
  </div>;
}
