import React, { useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { UNSAFE_NavigationContext, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useActivityId } from '@/os/ActivityContext';
import { getTracker } from '@/os/utils/memoryHistoryTracker';
import { useAppStrings } from '@/os/useAppStrings';
import { useContactEditorBack } from '../context/ContactEditorBackContext';
import { SymbolIcon } from '../components/SymbolIcon';
import { useContactsGestures } from '../hooks/useContactsGestures';
import { IcSymbolClose, IcSymbolOk } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { createContact, updateContactIfCurrent, useContact } from '../state';
import type { Contact } from '../types';
import { contactDraft, contactDraftDirty, contactDraftPatch, contactDraftWithDialedNumber, contactNewSourceDelta, nextContactFieldId } from '../utils/contactEditor';
import { contactOriginSuffix } from '../utils/detailOrigin';

export const NewContactPage: React.FC = () => {
  const { contactId } = useParams<{ contactId: string }>();
  return <ContactEditor key={contactId ?? 'new'} contactId={contactId} />;
};

function ContactEditor({ contactId }: { contactId?: string }) {
  const s = useAppStrings(strings, stringsEn), { bindBack, bindTap, go, back } = useContactsGestures();
  const contact = useContact(contactId), source = useRef<Contact | undefined>(contact).current;
  const [search] = useSearchParams();
  const initial = useRef((() => {
    const value = contactDraft(source);
    if (!contactId && search.get('number')) value.phones[0].number = search.get('number')!;
    return value;
  })()).current, [draft, setDraft] = useState(() => source && search.get('from') === 'dialpad' && search.get('number')
    ? contactDraftWithDialedNumber(source, search.get('number')!) : initial);
  const [error, setError] = useState(''), location = useLocation();
  const { navigator } = useContext(UNSAFE_NavigationContext), activityId = useActivityId();
  const backHandler = useContactEditorBack(), submitted = useRef(false), root = useRef<HTMLDivElement>(null);
  const editing = Boolean(contactId), modalOpen = search.get('modal') === 'discard';
  const sameSource = !editing || Boolean(source && contact === source);
  const dirty = contactDraftDirty(draft, initial), liveKey = useRef(location.key), mounted = useRef(true);
  liveKey.current = location.key;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const isCurrent = () => {
    const os = window.__OS__?.getState(), top = os?.tasks.find(task => task.taskId === os.activeTaskId)?.stack.at(-1);
    return mounted.current && top?.activityId === activityId && liveKey.current === location.key;
  };
  useLayoutEffect(() => {
    const handler = () => {
      if (!isCurrent() || submitted.current || modalOpen || !dirty) return false;
      if (contactId) go('contact.edit.discard.open', { contactId });
      else go('contact.new.discard.open');
      return true;
    };
    backHandler.current = handler;
    return () => { if (backHandler.current === handler) backHandler.current = null; };
  });
  const alignFocusedViewport = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    const owner = root.current, body = owner?.querySelector<HTMLElement>('.contacts-editor-body');
    if (!owner || !body) return;
    let frame = 0;
    const align = () => {
      const active = document.activeElement as HTMLElement | null;
      if (!active || !body.contains(active) || active.closest('[inert]')) return;
      const area = body.getBoundingClientRect(), field = active.getBoundingClientRect();
      if (!area.height) return;
      const scale = body.clientHeight / area.height;
      if (field.bottom > area.bottom) body.scrollTop += (field.bottom - area.bottom + 12) * scale;
      else if (field.top < area.top) body.scrollTop -= (area.top - field.top + 12) * scale;
    };
    alignFocusedViewport.current = align;
    const keepFocusedFieldVisible = () => {
      cancelAnimationFrame(frame);
      // ResizeObserver and actual text input must align before paint, not one rAF later.
      align(); frame = requestAnimationFrame(align);
    };
    const observer = new ResizeObserver(keepFocusedFieldVisible);
    observer.observe(body); owner.addEventListener('focusin', keepFocusedFieldVisible);
    return () => { alignFocusedViewport.current = () => {}; observer.disconnect(); owner.removeEventListener('focusin', keepFocusedFieldVisible); cancelAnimationFrame(frame); };
  }, []);

  const finish = () => {
    const parent = contactId ? `/contact/${encodeURIComponent(contactId)}${contactOriginSuffix(search)}` : '/contacts';
    const tracker = getTracker(navigator as object);
    const fromPicker = contactId && search.get('from') === 'dialpad' && search.get('number');
    const pickerIndex = tracker ? tracker.index - (modalOpen ? 2 : 1) : -1;
    const picker = pickerIndex >= 0 ? tracker?.stack[pickerIndex] : undefined;
    const pickerMatches = picker?.pathname === '/contacts/choose-existing' && new URLSearchParams(picker.search).get('number') === search.get('number');
    const sourceDelta = !contactId && tracker ? contactNewSourceDelta(tracker.stack, tracker.index) : null;
    const delta = fromPicker ? (pickerMatches ? tracker!.index - pickerIndex : -1) : sourceDelta ?? tracker?.findPopToDelta(parent, false) ?? -1;
    if (delta > 0) back(delta);
    else {
      const previous = tracker?.stack[tracker.index - 1];
      if (!fromPicker && modalOpen && previous?.pathname === location.pathname && !new URLSearchParams(previous.search).has('modal')) back();
      if (fromPicker) go('contact.existing.picker.return', { number: search.get('number')! });
      else if (contactId) go('contact.edit.finish', { contactId });
      else go('contact.new.finish');
    }
  };
  const save = () => {
    if (submitted.current || modalOpen || !sameSource || !isCurrent()) return;
    if (!draft.displayName.trim()) { setError(s.new_contact_name_required); return; }
    submitted.current = true;
    const patch = contactDraftPatch(draft, source);
    if (source) {
      if (!updateContactIfCurrent(source, patch)) { submitted.current = false; setError(s.contact_editor_source_changed); return; }
    } else createContact({ displayName: draft.displayName.trim(), phones: patch.phones ?? [], ...patch, starred: false });
    const active = document.activeElement as HTMLElement | null;
    if (active && root.current?.contains(active)) active.blur();
    finish();
  };
  const discard = () => {
    if (submitted.current || !modalOpen || !isCurrent()) return;
    submitted.current = true; finish();
  };
  const fieldAttrs = (field: string, value: string) => editing
    ? { 'data-action': 'contacts.edit.field.input', 'data-action-type': 'input', 'data-action-params': JSON.stringify({ field, value }) }
    : { 'data-action': 'contacts.new.field.input', 'data-action-type': 'input', 'data-action-params': JSON.stringify({ field, value }) };
  const textFields = [['displayName', s.contact_editor_name], ['company', s.contact_editor_company], ['title', s.contact_editor_job]] as const;
  const addPhone = () => setDraft(value => ({ ...value, phones: [...value.phones, { id: nextContactFieldId('p', value.phones), label: '手机', number: '', isPrimary: !value.phones.length }] }));
  const addEmail = () => setDraft(value => ({ ...value, emails: [...value.emails, { id: nextContactFieldId('e', value.emails), label: '工作', email: '', isPrimary: !value.emails.length }] }));

  return <div ref={root} onInputCapture={() => alignFocusedViewport.current()} className="contacts-editor" data-contact-editor-id={contactId ?? 'new'}>
    <div className="contacts-editor-owner" inert={modalOpen || undefined}>
      <header className="contacts-editor-header">
        <button type="button" aria-label={s.contact_editor_close} {...bindBack()}><SymbolIcon name={IcSymbolClose} size={22} /></button>
        <h1>{editing ? s.edit_contact_title : s.new_contact_title}</h1>
        <button type="button" aria-label={s.contact_editor_save} disabled={!sameSource} data-keep-keyboard="true" onPointerDown={event => event.preventDefault()}
          {...(editing ? bindTap({ kind: 'action', id: 'contacts.edit.save.submit' }, { onTrigger: save })
            : bindTap({ kind: 'action', id: 'contacts.new.save.submit' }, { onTrigger: save }))}><SymbolIcon name={IcSymbolOk} size={22} /></button>
      </header>
      <div className="contacts-editor-body" data-scroll-container="main" data-scroll-direction="vertical">
        {!sameSource && <p role="alert" className="contacts-editor-alert">{source ? s.contact_editor_source_changed : s.contact_not_found}</p>}
        {error && <p role="alert" className="contacts-editor-alert">{error}</p>}
        <div className="contacts-editor-avatar" aria-hidden="true" style={{ backgroundColor: source?.avatarColor }}>{(draft.displayName.trim()[0] ?? '').toUpperCase()}</div>
        <fieldset disabled={!sameSource}>
          <section className="contacts-editor-card">
            {textFields.map(([field, label]) => <label key={field} className="contacts-editor-field"><span>{label}</span>
              <input {...fieldAttrs(field, draft[field])} data-contact-field={field} value={draft[field]} autoComplete="off"
                onChange={event => { setError(''); setDraft(value => ({ ...value, [field]: event.target.value })); }} />
            </label>)}
          </section>
          <section className="contacts-editor-card" aria-label={s.section_phones}>
            <h2>{s.section_phones}</h2>
            {draft.phones.map((phone, index) => <div key={phone.id} className="contacts-editor-entry" data-contact-phone-id={phone.id}>
              <label className="contacts-editor-field"><span>{s.contact_editor_phone} {index + 1}</span><input {...fieldAttrs(`phone.${phone.id}.number`, phone.number)} data-contact-field="phone" inputMode="tel" value={phone.number} onChange={event => setDraft(value => ({ ...value, phones: value.phones.map(row => row.id === phone.id ? { ...row, number: event.target.value } : row) }))} /></label>
              <label className="contacts-editor-field"><span>{s.contact_editor_label}</span><input {...fieldAttrs(`phone.${phone.id}.label`, phone.label)} data-contact-field="phoneLabel" value={phone.label} onChange={event => setDraft(value => ({ ...value, phones: value.phones.map(row => row.id === phone.id ? { ...row, label: event.target.value } : row) }))} /></label>
              <div className="contacts-editor-entry-actions" data-keep-keyboard="true" onPointerDown={event => { if ((event.target as HTMLElement).closest('button')) event.preventDefault(); }}>
                <button type="button" aria-pressed={Boolean(phone.isPrimary)} aria-label={`${s.contact_editor_primary}: ${s.contact_editor_phone} ${index + 1}`}
                  {...(editing ? bindTap({ kind: 'action', id: 'contacts.edit.phone.primary' }, { params: { id: phone.id }, onTrigger: () => setDraft(value => ({ ...value, phones: value.phones.map(row => ({ ...row, isPrimary: row.id === phone.id })) })) })
                    : bindTap({ kind: 'action', id: 'contacts.new.phone.primary' }, { params: { id: phone.id }, onTrigger: () => setDraft(value => ({ ...value, phones: value.phones.map(row => ({ ...row, isPrimary: row.id === phone.id })) })) }))}>{phone.isPrimary ? '●' : '○'} {s.contact_editor_primary}</button>
                <button type="button" aria-label={`${s.contact_editor_remove_phone} ${index + 1}`}
                  {...(editing ? bindTap({ kind: 'action', id: 'contacts.edit.phone.remove' }, { params: { id: phone.id }, onTrigger: () => setDraft(value => ({ ...value, phones: value.phones.filter(row => row.id !== phone.id) })) })
                    : bindTap({ kind: 'action', id: 'contacts.new.phone.remove' }, { params: { id: phone.id }, onTrigger: () => setDraft(value => ({ ...value, phones: value.phones.filter(row => row.id !== phone.id) })) }))}>{s.contact_editor_remove_phone}</button>
              </div>
            </div>)}
            <button type="button" className="contacts-editor-add" data-keep-keyboard="true" onPointerDown={event => event.preventDefault()} {...(editing ? bindTap({ kind: 'action', id: 'contacts.edit.phone.add' }, { onTrigger: addPhone }) : bindTap({ kind: 'action', id: 'contacts.new.phone.add' }, { onTrigger: addPhone }))}>{s.contact_editor_add_phone}</button>
          </section>
          <section className="contacts-editor-card" aria-label={s.section_email}>
            <h2>{s.section_email}</h2>
            {draft.emails.map((email, index) => <div key={email.id} className="contacts-editor-entry" data-contact-email-id={email.id}>
              <label className="contacts-editor-field"><span>{s.contact_editor_email} {index + 1}</span><input {...fieldAttrs(`email.${email.id}.email`, email.email)} data-contact-field="email" inputMode="email" value={email.email} onChange={event => setDraft(value => ({ ...value, emails: value.emails.map(row => row.id === email.id ? { ...row, email: event.target.value } : row) }))} /></label>
              <label className="contacts-editor-field"><span>{s.contact_editor_label}</span><input {...fieldAttrs(`email.${email.id}.label`, email.label)} data-contact-field="emailLabel" value={email.label} onChange={event => setDraft(value => ({ ...value, emails: value.emails.map(row => row.id === email.id ? { ...row, label: event.target.value } : row) }))} /></label>
              <div className="contacts-editor-entry-actions" data-keep-keyboard="true" onPointerDown={event => { if ((event.target as HTMLElement).closest('button')) event.preventDefault(); }}>
                <button type="button" aria-pressed={Boolean(email.isPrimary)} aria-label={`${s.contact_editor_primary}: ${s.contact_editor_email} ${index + 1}`}
                  {...(editing ? bindTap({ kind: 'action', id: 'contacts.edit.email.primary' }, { params: { id: email.id }, onTrigger: () => setDraft(value => ({ ...value, emails: value.emails.map(row => ({ ...row, isPrimary: row.id === email.id })) })) })
                    : bindTap({ kind: 'action', id: 'contacts.new.email.primary' }, { params: { id: email.id }, onTrigger: () => setDraft(value => ({ ...value, emails: value.emails.map(row => ({ ...row, isPrimary: row.id === email.id })) })) }))}>{email.isPrimary ? '●' : '○'} {s.contact_editor_primary}</button>
                <button type="button" aria-label={`${s.contact_editor_remove_email} ${index + 1}`}
                  {...(editing ? bindTap({ kind: 'action', id: 'contacts.edit.email.remove' }, { params: { id: email.id }, onTrigger: () => setDraft(value => ({ ...value, emails: value.emails.filter(row => row.id !== email.id) })) })
                    : bindTap({ kind: 'action', id: 'contacts.new.email.remove' }, { params: { id: email.id }, onTrigger: () => setDraft(value => ({ ...value, emails: value.emails.filter(row => row.id !== email.id) })) }))}>{s.contact_editor_remove_email}</button>
              </div>
            </div>)}
            <button type="button" className="contacts-editor-add" data-keep-keyboard="true" onPointerDown={event => event.preventDefault()} {...(editing ? bindTap({ kind: 'action', id: 'contacts.edit.email.add' }, { onTrigger: addEmail }) : bindTap({ kind: 'action', id: 'contacts.new.email.add' }, { onTrigger: addEmail }))}>{s.contact_editor_add_email}</button>
          </section>
          <section className="contacts-editor-card"><label className="contacts-editor-field contacts-editor-notes"><span>{s.contact_editor_notes}</span><textarea {...fieldAttrs('notes', draft.notes)} data-contact-field="notes" rows={3} value={draft.notes} onChange={event => setDraft(value => ({ ...value, notes: event.target.value }))} /></label></section>
        </fieldset>
      </div>
    </div>
    {modalOpen && <DiscardContactDialog editing={editing} onDiscard={discard} />}
  </div>;
}

function DiscardContactDialog({ editing, onDiscard }: { editing: boolean; onDiscard: () => void }) {
  const s = useAppStrings(strings, stringsEn), { bindBack, bindTap, back } = useContactsGestures(), id = useId();
  const panel = useRef<HTMLElement>(null);
  useEffect(() => { panel.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, []);
  return <div className="contacts-delete-backdrop"><section ref={panel} className="contacts-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby={id}
    data-scroll-container="discard" data-scroll-direction="vertical" onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); back(); }
      if (event.key === 'Tab') { const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button')); const index = buttons.indexOf(document.activeElement as HTMLButtonElement); event.preventDefault(); buttons[(index + 1) % buttons.length]?.focus(); }
    }}>
    <h2 id={id}>{s.contact_editor_discard_title}</h2><p>{s.contact_editor_discard_message}</p>
    <div className="contacts-delete-buttons"><button type="button" {...bindBack()}>{s.cancel}</button><button type="button"
      {...(editing ? bindTap({ kind: 'action', id: 'contacts.edit.discard.submit' }, { onTrigger: onDiscard }) : bindTap({ kind: 'action', id: 'contacts.new.discard.submit' }, { onTrigger: onDiscard }))}>{s.contact_editor_discard}</button></div>
  </section></div>;
}
