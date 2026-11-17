
import React from 'react';
import { dimens } from '../res/dimens';
import { useWechatStrings } from '../hooks/useWechatStrings';
import { IcUserAdd, IcContacts, IcTag, IcFolder } from '../res/icons';
import { useWechatStore } from '../state';
import { useWechatGestures } from '../hooks/useWechatGestures';
import { useChatEntryOwner } from '../hooks/useChatEntryOwner';
import { useLocation } from 'react-router-dom';

const ContactItem: React.FC<{ 
  icon?: React.ReactNode; 
  name: string; 
  avatar?: string; 
  tapProps?: React.HTMLAttributes<HTMLDivElement>;
}> = ({ icon, name, avatar, tapProps }) => (
  <div
    {...tapProps}
    className={`wechat-contact-row flex items-center px-4 py-2.5 bg-app-surface active:bg-(--app-c-contacts-item-bg-active) border-b border-(--app-c-tw-border-gray-100) ${tapProps ? 'cursor-pointer' : ''}`}
  >
    <div className={`wechat-contact-avatar w-10 h-10 rounded-[4px] flex items-center justify-center ${!avatar ? 'bg-transparent' : ''}`}>
      {avatar ? (
         <img src={avatar} className="w-full h-full rounded-[4px] object-cover" alt="" loading="lazy" />
      ) : (
        icon
      )}
    </div>
    <span className="wechat-contact-name ml-3 text-(--app-settings-item-text-size)" style={{ color: 'var(--app-c-settings-item-text)' }}>{name}</span>
  </div>
);

const Contacts: React.FC = () => {
  const t = useWechatStrings();
  const { bindTap } = useWechatGestures();
  const contacts = useWechatStore(s => s.contacts);
  const ownsEntry = useChatEntryOwner(), location = useLocation();
  const listRef = React.useRef<HTMLDivElement>(null);
  const sections = React.useRef(new Map<string, HTMLDivElement>());
  const jump = (category: string) => {
    const list = listRef.current;
    if (!ownsEntry() || location.pathname !== '/contacts' || location.search || !list?.getClientRects().length) return;
    if (category === 'top') { list.scrollTo({top: 0, behavior: 'instant'}); return; }
    if (!useWechatStore.getState().contacts.some(contact => !contact.isBlacklisted && (contact.category?.trim() || '#') === category)) return;
    const section = sections.current.get(category);
    if (section) {
      // Computed height retains fractional layout pixels; offsetHeight rounds
      // them and accumulates visible drift on long, scaled contact lists.
      const bounds = list.getBoundingClientRect(), scale = bounds.height / parseFloat(getComputedStyle(list).height);
      if (scale > 0) list.scrollTo({top: list.scrollTop + (section.getBoundingClientRect().top - bounds.top) / scale, behavior: 'instant'});
    }
  };

  const alphabet = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
  const { visibleContacts, groupedContacts, activeCategories } = React.useMemo(() => {
    const visible = contacts.filter(c => !c.isBlacklisted);
    const grouped = new Map<string, typeof visible>();

    for (const contact of visible) {
      const category = contact.category?.trim() || '#';
      const group = grouped.get(category);
      if (group) group.push(contact);
      else grouped.set(category, [contact]);
    }

    return {
      visibleContacts: visible,
      groupedContacts: grouped,
      activeCategories: Array.from(grouped.keys()).sort(),
    };
  }, [contacts]);

  return (
    <div className="relative h-full bg-app-bg">
      {/* 联系人列表负责自身滚动，索引栏作为覆盖层独立出来，避免跟随列表一起滚动 */}
      <div
        ref={listRef}
        data-scroll-container="main"
        data-scroll-direction="vertical"
        className="h-full overflow-y-auto no-scrollbar pb-4"
      >
        <div className="mb-0">
          <ContactItem 
            icon={<div className="w-10 h-10 rounded-[4px] flex items-center justify-center" style={{ backgroundColor: 'var(--app-c-contacts-new-friend-icon-bg)' }}><IcUserAdd className="text-white" size={dimens.icSizeToolbar} /></div>}
            name={t.contacts_new_friend} 
            tapProps={bindTap<HTMLDivElement>('contacts.newFriends.open')}
          />
          <ContactItem 
              icon={<div className="w-10 h-10 bg-app-primary rounded-[4px] flex items-center justify-center"><IcContacts className="text-white" size={dimens.icSizeToolbar} fill="white" /></div>}
              name={t.contacts_group_chat}
              tapProps={bindTap<HTMLDivElement>('contacts.groups.open')}
          />
          <ContactItem 
              icon={<div className="w-10 h-10 rounded-[4px] flex items-center justify-center" style={{ backgroundColor: 'var(--app-c-contacts-tags-icon-bg)' }}><IcTag className="text-white" size={dimens.icSizeToolbar} fill="white" /></div>}
              name={t.contacts_tags}
              tapProps={bindTap<HTMLDivElement>('contacts.tags.open')}
          />
          <ContactItem
              icon={<div className="w-10 h-10 rounded-[4px] flex items-center justify-center" style={{ backgroundColor: 'var(--app-c-contacts-tags-icon-bg)' }}><IcFolder className="text-white" size={dimens.icSizeToolbar} fill="white" /></div>}
              name={t.contacts_official_accounts}
          />
        </div>

        {activeCategories.map(letter => {
           const group = groupedContacts.get(letter);
           if (!group || group.length === 0) return null;

           return (
            <div key={letter} id={`section-${letter}`} ref={node => { if (node) sections.current.set(letter, node); else sections.current.delete(letter); }}>
              <div className="px-4 py-1 text-xs text-(--app-c-tw-text-gray-500) bg-app-bg">{letter}</div>
              {group.map(contact => (
                <ContactItem 
                  key={contact.wxid} 
                  name={contact.name} 
                  avatar={contact.avatar} 
                  tapProps={bindTap<HTMLDivElement>('userProfile.open', { params: { id: contact.wxid } })}
                />
              ))}
            </div>
           )
        })}

        <div className="py-8 text-center text-(--app-c-tw-text-gray-400) text-base bg-app-surface border-t border-(--app-c-tw-border-gray-100)">
          {`${visibleContacts.length}${t.contacts_count_suffix}`}
        </div>
      </div>

      <nav className="wechat-contact-index" aria-label={t.contacts_index}>
        <button type="button" data-contact-index="top" aria-label={t.contacts_index_top}
          {...bindTap<HTMLButtonElement>({kind: 'action', id: 'wechat.contacts.index.jump'}, {params: {category: 'top'}, onTrigger: () => jump('top')})}>↑</button>
        <span aria-hidden="true">☆</span>
        {[...alphabet, '#'].map(letter => <button type="button" key={letter} data-contact-index={letter}
          disabled={!groupedContacts.has(letter)} aria-label={t.contacts_index_jump.replace('{{letter}}', letter)}
          {...(groupedContacts.has(letter) ? bindTap<HTMLButtonElement>({kind: 'action', id: 'wechat.contacts.index.jump'}, {params: {category: letter}, onTrigger: () => jump(letter)}) : {})}>{letter}</button>)}
      </nav>
    </div>
  );
};

export default Contacts;
