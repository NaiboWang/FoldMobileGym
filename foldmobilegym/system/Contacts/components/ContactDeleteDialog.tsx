import React, { useEffect, useRef } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useActivityId } from '@/os/ActivityContext';
import { useAppStrings } from '@/os/useAppStrings';
import { useContactsGestures } from '../hooks/useContactsGestures';
import { contactSourceIsCurrent, deleteContact, useContact } from '../state';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

export function ContactDeleteDialog({ returnFocus }: { returnFocus?: HTMLElement | null }) {
  const { contactId } = useParams<{ contactId: string }>();
  const contact = useContact(contactId), source = useRef(contact).current;
  const activityId = useActivityId(), location = useLocation(), liveKey = useRef(location.key); liveKey.current = location.key;
  const sameSource = Boolean(source && contact === source);
  const { bindBack, bindTap, go, back } = useContactsGestures();
  const s = useAppStrings(strings, stringsEn);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const submitted = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const previous = returnFocus ?? document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => { queueMicrotask(() => {
      const os = window.__OS__?.getState(), top = os?.tasks.find(task => task.taskId === os.activeTaskId)?.stack.at(-1);
      if (top?.activityId === activityId && previous?.isConnected && !previous.closest('[inert]')) previous.focus({ preventScroll: true });
    }); };
  }, [activityId, returnFocus]);
  const confirm = () => {
    const os = window.__OS__?.getState(), top = os?.tasks.find(task => task.taskId === os.activeTaskId)?.stack.at(-1);
    if (!mounted.current || !sameSource || !contact || !contactSourceIsCurrent(contact) || submitted.current || top?.activityId !== activityId || liveKey.current !== location.key) return;
    submitted.current = true;
    deleteContact(contact.id);
    // Trim the confirmation and deleted detail, including external detail entries.
    go('contact.delete.finish', {}, { popTo: `/contact/${contact.id}`, popToInclusive: true });
  };
  return (
    <div className="contacts-delete-backdrop">
      <section role="alertdialog" aria-modal="true" aria-labelledby="contacts-delete-title"
        aria-describedby="contacts-delete-description" className="contacts-delete-dialog"
        data-scroll-container="confirmation" data-scroll-direction="vertical"
        onKeyDown={event => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); back(); }
          if (event.key === 'Tab') {
            const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
            event.preventDefault(); buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus();
          }
        }}>
        <h2 id="contacts-delete-title">{s.delete_contact_title}</h2>
        <div id="contacts-delete-description">
          <p>{sameSource ? s.delete_contact_message : contact ? s.contact_editor_source_changed : s.contact_not_found}</p>
          {contact && <strong>{contact.displayName}</strong>}
        </div>
        <div className="contacts-delete-buttons">
          <button ref={cancelRef} type="button" {...bindBack<HTMLButtonElement>()}>{s.delete_contact_cancel}</button>
          <button type="button" disabled={!sameSource}
            {...bindTap({ kind: 'action', id: 'contacts.contact.delete.submit' }, {
              params: { contactId: contactId ?? '' }, onTrigger: confirm,
            })}>{s.delete_contact_confirm}</button>
        </div>
      </section>
    </div>
  );
}
