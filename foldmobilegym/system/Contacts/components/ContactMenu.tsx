import React, { useEffect, useId, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAppStrings } from '@/os/useAppStrings';
import { useContactsGestures } from '../hooks/useContactsGestures';
import { useContactDetailOwner } from '../hooks/useContactDetailOwner';
import { useContact } from '../state';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

export function ContactMenu() {
  const { contactId } = useParams<{ contactId: string }>(), contact = useContact(contactId);
  const s = useAppStrings(strings, stringsEn), { bindBack, bindTap, go, closeMenu } = useContactsGestures();
  const ownsMenu = useContactDetailOwner(contact, { menu: 'more', allowMissing: true });
  const backBinding = bindBack<HTMLButtonElement>();
  const panel = useRef<HTMLElement>(null), titleId = useId();
  useEffect(() => {
    const app = panel.current?.closest('[data-app-id]');
    panel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    return () => { queueMicrotask(() => {
      const opener = app?.querySelector<HTMLButtonElement>('[data-trigger="contact.menu.open"]');
      if (opener?.checkVisibility() && !opener.closest('[inert]')) opener.focus({ preventScroll: true });
    }); };
  }, []);
  return <div className="contacts-delete-backdrop"><section ref={panel} className="contacts-delete-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}
    data-scroll-container="menu" data-scroll-direction="vertical" onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (ownsMenu()) closeMenu(); }
      if (event.key === 'Tab') { const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')); const index = buttons.indexOf(document.activeElement as HTMLButtonElement); event.preventDefault(); buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus(); }
    }}>
    <h2 id={titleId}>{s.contact_menu_title}</h2><p>{contact?.displayName ?? s.contact_not_found}</p>
    <div className="contacts-menu-actions">
      <button type="button" disabled={!contact} {...bindTap('contact.edit.open', { params: { contactId: contactId ?? '' }, onTrigger: () => { if (ownsMenu() && contactId) go('contact.edit.open', { contactId }); } })}>{s.edit}</button>
      <button type="button" {...backBinding} onClick={event => { if (ownsMenu()) backBinding.onClick?.(event); }}>{s.cancel}</button>
    </div>
  </section></div>;
}
