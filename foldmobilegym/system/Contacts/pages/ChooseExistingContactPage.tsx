import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Search, UserRound } from 'lucide-react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useActivityId } from '@/os/ActivityContext';
import { useAppStrings } from '@/os/useAppStrings';
import { useContactsGestures } from '../hooks/useContactsGestures';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { contactSourceIsCurrent, useContactsList } from '../state';
import { contactsCollator } from '../utils/contactSections';

/** Simulator picker: no contact is modified until the resulting editor is saved. */
export function ChooseExistingContactPage() {
  const contacts = useContactsList(), [search] = useSearchParams(), location = useLocation();
  const number = search.get('number') ?? '', [query, setQuery] = useState(''), submitted = useRef(false);
  const activityId = useActivityId(), { bindBack, bindTap, go } = useContactsGestures();
  const s = useAppStrings(strings, stringsEn);
  const filtered = useMemo(() => {
    const term = query.toLocaleLowerCase().replace(/\s+/g, '');
    return contacts.filter(contact => !term || contact.displayName.toLocaleLowerCase().replace(/\s+/g, '').includes(term)
      || contact.phones.some(phone => phone.number.toLocaleLowerCase().replace(/\s+/g, '').includes(term)))
      .slice().sort((a, b) => contactsCollator.compare(a.sortKey || a.displayName, b.sortKey || b.displayName));
  }, [contacts, query]);
  const ownsPicker = () => {
    const os = window.__OS__?.getState(), top = os?.tasks.find(task => task.taskId === os.activeTaskId)?.stack.at(-1);
    return Boolean(number && !os?.isLauncherVisible && !os?.isRecentsVisible && top?.activityId === activityId
      && window.__OS__?.getAppRoute('contacts')?.path === location.pathname + location.search);
  };
  return <div className="contacts-existing-picker">
    <header className="contacts-existing-picker-header">
      <button type="button" aria-label={s.contact_editor_close} {...bindBack()}><ArrowLeft size={22} /></button>
      <h1>{s.dialpad_choose_existing}</h1>
    </header>
    <label className="contacts-existing-picker-search"><Search size={18} aria-hidden="true" />
      <input aria-label={s.searchHint} placeholder={s.searchHint} value={query} onChange={event => setQuery(event.target.value)} />
    </label>
    <div className="contacts-existing-picker-list" data-scroll-container="main" data-scroll-direction="vertical">
      {filtered.map(contact => <button key={contact.id} type="button" disabled={!number} data-existing-contact-id={contact.id}
        {...bindTap('contact.existing.edit', { params: { contactId: contact.id, number }, onTrigger: () => {
          if (submitted.current || !ownsPicker() || !contactSourceIsCurrent(contact)) return;
          submitted.current = true; window.__OS__?.keyboard.hide(); go('contact.existing.edit', { contactId: contact.id, number });
        } })}>
        <span className="contacts-existing-picker-avatar"><UserRound size={25} /></span>
        <span className="contacts-existing-picker-name">{contact.displayName}</span>
      </button>)}
      {!filtered.length && <p>{s.searchNoResults}</p>}
    </div>
  </div>;
}
