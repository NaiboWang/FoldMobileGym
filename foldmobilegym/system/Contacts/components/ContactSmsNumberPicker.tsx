import React, { useContext, useEffect, useId, useLayoutEffect, useRef } from 'react';
import { UNSAFE_NavigationContext, useLocation, useParams } from 'react-router-dom';
import { useActivityId } from '@/os/ActivityContext';
import { useOS } from '@/os/OSContext';
import { useLocale } from '@/os/locale';
import { useAppStrings } from '@/os/useAppStrings';
import { useContactsGestures } from '../hooks/useContactsGestures';
import { useContactDetailOwner } from '../hooks/useContactDetailOwner';
import { contactSourceIsCurrent, useContact } from '../state';
import type { ContactPhone } from '../types';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { localizeContactLabel } from '../utils/localizedText';
import { contactSmsAddress, contactSmsPhones, contactSmsPickerBackFallback } from '../utils/smsPhoneChoice';

/** Local recipient selection only; this never sends an SMS. */
export function ContactSmsNumberPicker({ returnFocus }: { returnFocus?: HTMLElement | null }) {
  const { contactId } = useParams<{ contactId: string }>(), contact = useContact(contactId);
  const source = useRef(contact).current, submitted = useRef(false), panel = useRef<HTMLElement>(null);
  const activityId = useActivityId(), locale = useLocale(), titleId = useId();
  const { state: osState } = useOS();
  const location = useLocation(), { navigator } = useContext(UNSAFE_NavigationContext);
  const ownsPicker = useContactDetailOwner(contact, { modal: 'sms', allowMissing: true });
  const { bindTap, bindBack, closeSmsPicker } = useContactsGestures();
  const s = useAppStrings(strings, stringsEn), sameSource = !!source && source === contact;
  const choices = source ? contactSmsPhones(source.phones) : [];
  useEffect(() => {
    panel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
    return () => { queueMicrotask(() => {
      const os = window.__OS__?.getState(), top = os?.tasks.find(task => task.taskId === os.activeTaskId)?.stack.at(-1);
      const current = (navigator as { location?: typeof location }).location;
      const ownParent = current && contactSmsPickerBackFallback(location.pathname, location.search, current) === null;
      if (!os?.isLauncherVisible && !os?.isRecentsVisible && top?.activityId === activityId
        && ownParent && source && contactSourceIsCurrent(source) && returnFocus?.isConnected && !returnFocus.closest('[inert]')
        && returnFocus.closest('[data-benchmark-source-id]')?.getAttribute('data-benchmark-source-id') === source.id) {
        returnFocus.focus({ preventScroll: true });
      }
    }); };
  }, [activityId, location.pathname, location.search, navigator, returnFocus, source]);
  // Disabling a focused stale choice makes the browser drop focus to the page.
  // Keep keyboard dismissal inside this dialog, but never steal focus from a background task.
  useLayoutEffect(() => {
    if (!sameSource && ownsPicker() && panel.current && (!panel.current.contains(document.activeElement) || (document.activeElement as HTMLButtonElement | null)?.disabled)) {
      panel.current.querySelector<HTMLButtonElement>('.contacts-sms-number-cancel')?.focus({ preventScroll: true });
    }
  }, [sameSource, ownsPicker, osState.activeTaskId, osState.isLauncherVisible, osState.isRecentsVisible, osState.tasks]);
  const choose = (phone: ContactPhone, address: string) => {
    if (!ownsPicker() || submitted.current || !sameSource || !source || !contactSourceIsCurrent(source)
      || !contactSmsPhones(source.phones).includes(phone) || contactSmsAddress(phone.number) !== address) return;
    submitted.current = true;
    closeSmsPicker();
    // Borrow, rather than replace, a warm SMS task and its general draft.
    window.__OS__?.startActivity({ action: 'ACTION_VIEW', scheme: 'sms', data: { address } });
  };
  const backBinding = bindBack<HTMLButtonElement>();
  return <div className="contacts-delete-backdrop contacts-sms-picker-backdrop">
    <button type="button" className="contacts-sms-picker-scrim" aria-label={s.cancel} {...backBinding}
      onClick={event => { if (ownsPicker()) backBinding.onClick?.(event); }} />
    <section ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId}
      className="contacts-delete-dialog contacts-sms-number-picker" data-scroll-container="smsNumbers" data-scroll-direction="vertical"
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (ownsPicker()) closeSmsPicker(); }
        if (event.key === 'Tab') {
          const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement); event.preventDefault();
          buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus();
        }
      }}>
      <h2 id={titleId}>{s.sms_choose_number}</h2>
      <p role="status">{!contact ? s.contact_not_found : !sameSource ? s.contact_editor_source_changed : contact.displayName}</p>
      {choices.length ? choices.map(phone => {
        const address = contactSmsAddress(phone.number);
        return <button key={`${phone.id}:${address}`} type="button" className="contacts-sms-number-choice" disabled={!sameSource}
          data-contacts-sms-number={address} {...bindTap({ kind: 'action', id: 'contacts.contact.sms.choose' }, {
            params: { contactId: contactId ?? '', phoneId: phone.id, number: phone.number }, onTrigger: () => choose(phone, address),
          })}>
          <span>{phone.number}</span><small>{localizeContactLabel(phone.label, locale)}</small>
        </button>;
      }) : <p>{s.contact_no_phone}</p>}
      <button type="button" className="contacts-sms-number-cancel" {...backBinding}
        onClick={event => { if (ownsPicker()) backBinding.onClick?.(event); }}>{s.cancel}</button>
    </section>
  </div>;
}
