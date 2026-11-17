import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { Info, Star, UserRound } from 'lucide-react';
import { Toast } from '@/os/components/Toast';
import { useLocale } from '@/os/locale';
import { useActivityId } from '@/os/ActivityContext';
import { useAppStrings } from '@/os/useAppStrings';
import { SymbolIcon } from '../components/SymbolIcon';
import { useContactsGestures } from '../hooks/useContactsGestures';
import { useContactsList } from '../state';
import { useContactDirectoryBack } from '../context/ContactDirectoryBackContext';
import { contactSectionKey, contactsCollator } from '../utils/contactSections';
import type { Contact } from '../types';
import { colors } from '../res/colors';
import { IcNavForward, IcSymbolAdd, IcSymbolBack, IcSymbolClose2, IcSymbolExpandMore, IcSymbolFavorites, IcSymbolFavoritesFill, IcSymbolMore, IcSymbolSearch, IcSymbolSettings } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

function contactSortKey(contact: Contact): string {
  return (contact.sortKey ?? contact.displayName ?? '').trim() || '#';
}

const ContactRow: React.FC<{
  name: string;
  subtitle?: string;
  showDivider?: boolean;
  onClick?: () => void;
  tapProps?: React.HTMLAttributes<HTMLButtonElement>;
  selected?: boolean;
  trailing?: 'info' | 'chevron';
  genericAvatar?: boolean;
}> = ({ name, subtitle, showDivider = true, onClick, tapProps, selected, trailing = 'info', genericAvatar = false }) => (
  <div className="contacts-reference-row bg-app-surface">
    <button
      type="button"
      aria-current={selected ? 'page' : undefined}
      {...(tapProps || {})}
      className={[
        'w-full px-6 py-4 flex items-center justify-between active:bg-black/5 text-left',
        tapProps?.className ?? '',
      ].join(' ')}
      onClick={(event) => {
        tapProps?.onClick?.(event);
        onClick?.();
      }}
    >
      <span className="contacts-reference-row-avatar" aria-hidden="true">{genericAvatar ? <UserRound size={25} strokeWidth={1.7} /> : (name.trim()[0] || '#')}</span>
      <span className="contacts-reference-row-copy min-w-0 flex-1">
        <span className="contacts-reference-row-name block text-[18px] text-app-text">{name}</span>
        {subtitle ? <span className="contacts-reference-row-subtitle block mt-1 text-[13px] text-gray-400 truncate">{subtitle}</span> : null}
      </span>
      {trailing === 'info'
        ? <Info className="w-5 h-5 text-gray-500 flex-none" strokeWidth={1.8} />
        : <IcNavForward className="w-5 h-5 text-gray-300 flex-none" />}
    </button>
    {showDivider ? <div className="h-px bg-black/5 ml-6" /> : null}
  </div>
);

const ContactsFab: React.FC<{
  label: string;
  tapProps: React.HTMLAttributes<HTMLButtonElement>;
  icon?: string;
  favorite?: boolean;
  directory?: boolean;
}> = ({ label, tapProps, icon = IcSymbolAdd, favorite = false, directory = false }) => (
  <button
    type="button"
    {...tapProps}
    style={{
      ...(tapProps.style || {}),
      backgroundColor: colors.fab_background,
    }}
    className={[
      'absolute right-6 bottom-[92px] w-16 h-16 rounded-full shadow-[0_10px_24px_rgba(0,0,0,0.16)]',
      'flex items-center justify-center active:scale-95 transition-transform',
      tapProps.className ?? '',
      directory ? 'contacts-directory-fab' : '',
    ].join(' ')}
    aria-label={label}
  >
    {favorite ? <Star size={32} strokeWidth={1.8} className="text-white" /> : <SymbolIcon name={icon} size={32} className="text-white" />}
  </button>
);

const ALPHABET_SECTIONS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];

const AlphabetIndex: React.FC<{
  activeKey: string | undefined;
  availableKeys: string[];
  label: string;
  onPick: (key: string) => void;
}> = ({ activeKey, availableKeys, label, onPick }) => {
  const selectedIndex = Math.max(0, ALPHABET_SECTIONS.indexOf(activeKey ?? '#'));
  const pickAt = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.height) return;
    const index = Math.max(0, Math.min(ALPHABET_SECTIONS.length - 1,
      Math.floor((event.clientY - rect.top) / rect.height * ALPHABET_SECTIONS.length)));
    onPick(ALPHABET_SECTIONS[index]);
  };
  return (
    <div
      className="contacts-alphabet-index absolute right-1 top-[184px] bottom-[130px] flex items-center"
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={ALPHABET_SECTIONS.length - 1}
      aria-valuenow={selectedIndex}
      aria-valuetext={ALPHABET_SECTIONS[selectedIndex]}
      onPointerDown={event => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); pickAt(event); }}
      onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) pickAt(event); }}
      onKeyDown={event => {
        const delta = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0;
        if (!delta && event.key !== 'Home' && event.key !== 'End') return;
        event.preventDefault();
        if (event.key === 'Home' || event.key === 'End') {
          const key = event.key === 'Home' ? availableKeys[0] : availableKeys.at(-1);
          if (key) onPick(key);
          return;
        }
        for (let index = selectedIndex + delta; index >= 0 && index < ALPHABET_SECTIONS.length; index += delta) {
          if (availableKeys.includes(ALPHABET_SECTIONS[index])) { onPick(ALPHABET_SECTIONS[index]); break; }
        }
      }}
    >
      <div className="contacts-alphabet-rail w-8 h-full flex flex-col items-center justify-center select-none" aria-hidden="true">
        {ALPHABET_SECTIONS.map(key => <span key={key} data-section={key} className={`contacts-alphabet-letter ${activeKey === key ? 'is-active' : ''}`}>{key}</span>)}
      </div>
    </div>
  );
};

export const ContactsPage: React.FC<{
  detailTapProps?: (contactId: string) => React.HTMLAttributes<HTMLButtonElement>;
  directory?: boolean;
  onDirectorySearchChange?: (active: boolean) => void;
}> = ({ detailTapProps, directory = false, onDirectorySearchChange }) => {
  const activityId = useActivityId();
  const { contactId: selectedContactId } = useParams<{ contactId: string }>();
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const contacts = useContactsList();
  const { bindTap } = useContactsGestures();
  const [searchParams, setSearchParams] = useSearchParams();
  const favOnly = searchParams.get('fav') === 'true';
  const routeQuery = directory ? (searchParams.get('q') ?? '') : '';
  const [directoryQuery, setDirectoryInput] = useState(routeQuery);
  const [directorySearchActive, setDirectorySearchActive] = useState(Boolean(routeQuery));
  const directorySearchInput = useRef<HTMLInputElement>(null);
  useEffect(() => { onDirectorySearchChange?.(directorySearchActive); }, [directorySearchActive, onDirectorySearchChange]);
  const directoryBack = useContactDirectoryBack();
  useEffect(() => { if (routeQuery) setDirectorySearchActive(true); }, [routeQuery]);
  // Route replacements can settle after several input events; keep the latest draft until acknowledged.
  const pendingDirectoryInput = useRef<string | null>(null);
  const directorySource = useRef(selectedContactId);
  useEffect(() => {
    if (directorySource.current !== selectedContactId) {
      directorySource.current = selectedContactId;
      pendingDirectoryInput.current = null;
    }
    if (pendingDirectoryInput.current !== null) {
      if (pendingDirectoryInput.current !== routeQuery) return;
      pendingDirectoryInput.current = null;
    }
    setDirectoryInput(current => current === routeQuery ? current : routeQuery);
  }, [directoryQuery, routeQuery, selectedContactId]);
  const s = useAppStrings(strings, stringsEn);

  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const toastTimerRef = useRef<number | null>(null);
  const showToast = (message: string) => {
    setToast({ visible: true, message });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast({ visible: false, message: '' }), 1400);
  };

  const collator = contactsCollator;

  const displayContacts = useMemo(() => {
    const list = contacts.slice();
    const favoritesFiltered = favOnly ? list.filter((contact) => Boolean(contact.starred)) : list;
    const normalizedQuery = directoryQuery.trim().replace(/\s+/g, '').toLowerCase();
    const filtered = normalizedQuery
      ? favoritesFiltered.filter(contact => {
          if (contact.displayName.toLowerCase().replace(/\s+/g, '').includes(normalizedQuery)) return true;
          return contact.phones.some(phone => phone.number.replace(/\s+/g, '').toLowerCase().includes(normalizedQuery));
        })
      : favoritesFiltered;
    return filtered.sort((left, right) => collator.compare(contactSortKey(left), contactSortKey(right)));
  }, [contacts, favOnly, directoryQuery, collator]);

  const setDirectoryQuery = (value: string) => {
    pendingDirectoryInput.current = value;
    setDirectoryInput(value);
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      if (value) next.set('q', value); else next.delete('q');
      return next;
    }, { replace: true });
  };

  const ownsDirectory = () => {
    const os = window.__OS__?.getState();
    return !!activityId && !os?.isLauncherVisible && !os?.isRecentsVisible
      && os?.tasks.find(task => task.taskId === os.activeTaskId)?.stack.at(-1)?.activityId === activityId;
  };

  useEffect(() => {
    const handler = () => {
      const input = directorySearchInput.current;
      if (!directory || !directorySearchActive || !ownsDirectory() || !input?.checkVisibility() || input.closest('[inert]')) return false;
      input.blur();
      setDirectoryQuery('');
      setDirectorySearchActive(false);
      return true;
    };
    directoryBack.current = handler;
    return () => { if (directoryBack.current === handler) directoryBack.current = null; };
  });

  const grouped = useMemo(() => {
    const map = new Map<string, Contact[]>();
    for (const contact of displayContacts) {
      const key = contactSectionKey(contact);
      const entries = map.get(key) ?? [];
      entries.push(contact);
      map.set(key, entries);
    }
    return map;
  }, [displayContacts]);

  const sectionKeys = useMemo(() => {
    const keys = Array.from(grouped.keys());
    keys.sort((left, right) => {
      if (left === '#') return right === '#' ? 0 : -1;
      if (right === '#') return 1;
      return left.localeCompare(right);
    });
    return keys;
  }, [grouped]);

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const listRef = useRef<HTMLDivElement | null>(null);
  const [activeSection, setActiveSection] = useState<string | undefined>();
  const currentSection = activeSection && sectionKeys.includes(activeSection) ? activeSection : sectionKeys[0];
  const updateActiveSection = () => {
    const list = listRef.current;
    if (!list || !sectionKeys.length) return;
    const bounds = list.getBoundingClientRect();
    const scale = list.clientHeight ? bounds.height / list.clientHeight : 1;
    let current = sectionKeys[0];
    for (const key of sectionKeys) {
      const section = sectionRefs.current[key];
      if (section && section.getBoundingClientRect().top <= bounds.top + 24 * scale) current = key;
    }
    if (list.scrollTop + list.clientHeight >= list.scrollHeight - 2 && list.scrollTop > 0) current = sectionKeys.at(-1) ?? current;
    setActiveSection(previous => previous === current ? previous : current);
  };
  const scrollTo = (key: string) => {
    const list = listRef.current, section = sectionRefs.current[key];
    if (!list || !section) return;
    const bounds = list.getBoundingClientRect();
    const scale = list.clientHeight ? bounds.height / list.clientHeight : 1;
    list.scrollTo({ top: list.scrollTop + (section.getBoundingClientRect().top - bounds.top) / (scale || 1), behavior: 'smooth' });
    setActiveSection(key);
  };

  const favoriteToggleProps = favOnly ? bindTap('contacts.favorites.off') : bindTap('contacts.favorites.on');

  return (
    <div className="h-full w-full bg-app-surface relative flex flex-col">
      <Toast visible={toast.visible} message={toast.message} />

      <div className="sticky top-0 z-20 bg-app-surface">
        {directory ? (
          <>
            <div className="h-10" />
            {!directorySearchActive && <div className="px-6 pt-2 pb-3">
              <div className="contacts-page-title text-[36px] font-semibold text-app-text">{s.contactsAllLabel}</div>
              <div className="text-[14px] text-gray-400">{s.contactsCount.replace('{count}', String(contacts.length))}</div>
            </div>}
            <div className="contacts-directory-header h-[62px] px-3 flex items-center gap-2" data-search-active={directorySearchActive}>
              {directorySearchActive && <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  if (!ownsDirectory() || !directorySearchInput.current?.checkVisibility() || directorySearchInput.current.closest('[inert]')) return;
                  directorySearchInput.current?.blur();
                  setDirectoryQuery('');
                  setDirectorySearchActive(false);
                }}
                className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5"
                aria-label={isEnglish ? 'Back' : '返回'}
              >
                <SymbolIcon name={IcSymbolBack} size={22} className="text-app-text" />
              </button>}
              <div className="flex-1 h-11 rounded-full bg-black/5 flex items-center px-4 text-[15px] text-gray-400">
                <SymbolIcon name={IcSymbolSearch} size={18} className="text-gray-400 mr-2" />
                <input
                  ref={directorySearchInput}
                  value={directoryQuery}
                  onFocus={() => setDirectorySearchActive(true)}
                  onChange={event => setDirectoryQuery(event.target.value)}
                  placeholder={s.searchHint}
                  aria-label={s.searchHint}
                  className="contacts-directory-search flex-1 min-w-0 bg-transparent outline-none text-[15px] text-app-text placeholder:text-gray-400"
                />
                {directoryQuery ? (
                  <button
                    type="button"
                    aria-label={isEnglish ? 'Clear' : '清空'}
                    className="w-7 h-7 rounded-full flex items-center justify-center active:bg-black/5"
                    onClick={() => setDirectoryQuery('')}
                  >
                    <SymbolIcon name={IcSymbolClose2} size={17} className="text-gray-400" />
                  </button>
                ) : null}
              </div>
            </div>
          </>
        ) : <>
        <div className="h-10" />
        <div className="px-6 pt-2 pb-3 relative">
          <div className="contacts-page-title text-[36px] font-semibold text-app-text">{favOnly ? s.personalFavoritesLabel : s.contactsAllLabel}</div>
          <button
            type="button"
            aria-label={isEnglish ? 'Settings' : '设置'}
            {...bindTap('settings.open.contacts')}
            className="absolute right-5 top-2 w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5"
          >
            <SymbolIcon name={favOnly ? IcSymbolMore : IcSymbolSettings} size={24} className="text-gray-700" />
          </button>
        </div>

        {!favOnly ? <div className="px-6 pb-2">
          <button
            type="button"
            {...bindTap('search.open')}
            className="w-full h-11 rounded-full bg-black/5 flex items-center px-4 text-[16px] text-gray-400 active:bg-black/10 text-left"
          >
            <SymbolIcon name={IcSymbolSearch} size={18} className="text-gray-400 mr-2" />
            {s.searchHint}
          </button>
        </div> : null}

        {!favOnly ? <div className="px-6 pb-2 flex items-center justify-between">
          <button type="button" className="text-[16px] font-semibold text-[#9CA3AF] flex items-center gap-1 active:opacity-70">
            {s.contactsFilterAll}
            <SymbolIcon name={IcSymbolExpandMore} size={18} className="text-[#9CA3AF]" />
          </button>
          <button
            type="button"
            aria-label={isEnglish ? 'Favorites' : '收藏'}
            {...favoriteToggleProps}
            className="w-9 h-9 rounded-full flex items-center justify-center active:bg-black/5"
          >
            <SymbolIcon
              name={favOnly ? IcSymbolFavoritesFill : IcSymbolFavorites}
              size={18}
              className={favOnly ? 'text-[#FF4D2D]' : 'text-gray-300'}
            />
          </button>
        </div> : null}
        </>}
      </div>

      <div className={`contacts-directory-list-region ${directory ? 'relative' : 'static'} flex-1 min-h-0 flex flex-col`} data-directory={directory || undefined}>
      <div ref={listRef} onScroll={updateActiveSection} className="flex-1 overflow-y-auto no-scrollbar pb-[118px]" data-scroll-container={directory ? 'directory' : 'main'} data-scroll-direction="vertical">
        {!favOnly && !directoryQuery ? <div className="bg-app-surface">
          {!directory ? <ContactRow
            name={s.bluetoothChat}
            trailing="chevron"
            onClick={() => showToast(isEnglish ? 'Offline Chat is not implemented yet' : '无网通（未实现）')}
          /> : null}
          <ContactRow
            name={s.myCard}
            genericAvatar
            trailing="chevron"
            onClick={() => showToast(isEnglish ? 'My Profile is not implemented yet' : '我的名片（未实现）')}
          />
          {!directory ? <ContactRow
            name={s.myGroups}
            trailing="chevron"
            showDivider={false}
            onClick={() => showToast(isEnglish ? 'My Groups is not implemented yet' : '我的群组（未实现）')}
          /> : null}
        </div> : null}

        {favOnly ? displayContacts.map((contact, index) => {
          const tapProps = detailTapProps?.(contact.id)
            ?? bindTap('contact.open', { params: { contactId: contact.id } });
          return (
            <React.Fragment key={contact.id}>
              {index === 1 ? <div className="px-6 pt-7 pb-2 text-[16px] text-gray-500">{s.frequentList}</div> : null}
              <ContactRow
                name={contact.displayName}
                subtitle={contact.phones[0]?.number}
                selected={contact.id === selectedContactId}
                showDivider={index < displayContacts.length - 1}
                tapProps={tapProps}
              />
            </React.Fragment>
          );
        }) : sectionKeys.map((key) => {
          const list = grouped.get(key) ?? [];
          if (!list.length) return null;

          return (
            <div key={key}>
              <div
                ref={(element) => {
                  sectionRefs.current[key] = element;
                }}
                data-contact-section={key}
                className="px-6 py-3 text-[18px] text-gray-300 font-semibold"
              >
                {key}
              </div>
              {list.map((contact, index) => {
                const tapProps = detailTapProps?.(contact.id)
                  ?? bindTap('contact.open', { params: { contactId: contact.id } });
                return (
                  <ContactRow
                    key={contact.id}
                    name={contact.displayName}
                    subtitle={contact.phones[0]?.number}
                    selected={contact.id === selectedContactId}
                    showDivider={index < list.length - 1}
                    tapProps={tapProps}
                  />
                );
              })}
            </div>
          );
        })}
        {directory && directoryQuery.trim() && displayContacts.length === 0 ? (
          <div className="px-6 py-10 text-center text-[14px] text-gray-400">{s.searchNoResults}</div>
        ) : null}
      </div>

      {!favOnly && !directoryQuery ? <AlphabetIndex label={s.contactsIndexLabel} availableKeys={sectionKeys} activeKey={currentSection} onPick={scrollTo} /> : null}
      {directory && directorySearchActive && !directoryQuery && <div className="contacts-directory-search-scrim" aria-hidden="true" />}
      </div>

      {!directory || !directorySearchActive ? <ContactsFab
        label={isEnglish ? 'Create contact' : '新建联系人'}
        tapProps={bindTap('contact.new.open')}
        icon={IcSymbolAdd}
        favorite={favOnly}
        directory={directory}
      /> : null}
    </div>
  );
};
