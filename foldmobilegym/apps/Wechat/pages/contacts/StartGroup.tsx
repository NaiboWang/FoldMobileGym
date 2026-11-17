import React, {useMemo, useRef, useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {useWechatStrings} from '../../hooks/useWechatStrings';
import {useWechatGestures} from '../../hooks/useWechatGestures';
import {useChatEntryOwner} from '../../hooks/useChatEntryOwner';
import {useWechatStore} from '../../state';
import {matchContact} from '../../utils/pinyinSearch';
import {selectedContactSourcesValid} from '../../utils/groupChat';
import type {ContactItem} from '../../types';
import {IcNavBack, IcSearch} from '../../res/icons';
import {dimens} from '../../res/dimens';

export const StartGroupPage: React.FC = () => {
  const t = useWechatStrings(), {bindBack, bindTap, go} = useWechatGestures(), owns = useChatEntryOwner();
  const contacts = useWechatStore(state => state.contacts), user = useWechatStore(state => state.user);
  const loggedIn = useWechatStore(state => state.auth?.session.loggedIn);
  const [params, setParams] = useSearchParams(), query = params.get('q') || '';
  const [selected, setSelected] = useState(new Map<string, ContactItem>());
  const actor = useRef(user.wxid), claimed = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const sections = useRef(new Map<string, HTMLElement>());
  const sourceChanged = actor.current !== user.wxid || !loggedIn || !selectedContactSourcesValid(selected, contacts, user.wxid);
  const {groups, categories, count} = useMemo(() => {
    const visible = contacts.filter(contact => !contact.isBlacklisted && contact.wxid !== user.wxid && (!query.trim() || matchContact(contact, query)));
    const groups = new Map<string, ContactItem[]>();
    for (const contact of visible) {
      const key = contact.category?.trim() || '#'; groups.set(key, [...(groups.get(key) || []), contact]);
    }
    return {groups, categories: [...groups.keys()].sort(), count: visible.length};
  }, [contacts, query, user.wxid]);
  const jump = (category: string) => {
    const list = listRef.current, live = useWechatStore.getState();
    if (!owns() || claimed.current || !live.auth?.session.loggedIn || live.user.wxid !== actor.current || !list?.getClientRects().length) return;
    if (category === 'top') { list.scrollTo({top: 0, behavior: 'instant'}); return; }
    // Only visible current sources may be targeted, including when filtered.
    if (!live.contacts.some(contact => !contact.isBlacklisted && contact.wxid !== live.user.wxid
      && (contact.category?.trim() || '#') === category && (!query.trim() || matchContact(contact, query)))) return;
    const section = sections.current.get(category);
    if (!section) return;
    const bounds = list.getBoundingClientRect();
    const scale = bounds.height / parseFloat(getComputedStyle(list).height);
    if (scale > 0 && Number.isFinite(scale)) list.scrollTo({top: list.scrollTop + (section.getBoundingClientRect().top - bounds.top) / scale, behavior: 'instant'});
  };
  const toggle = (contact: ContactItem) => {
    if (!owns() || !loggedIn || actor.current !== useWechatStore.getState().user.wxid || claimed.current) return;
    if (!useWechatStore.getState().contacts.includes(contact) || contact.isBlacklisted) return;
    setSelected(previous => {const next = new Map(previous); if (next.has(contact.wxid)) next.delete(contact.wxid); else next.set(contact.wxid, contact); return next;});
  };
  const submit = () => {
    const live = useWechatStore.getState(), members = [...selected.values()];
    if (!owns() || claimed.current || !live.auth?.session.loggedIn || live.user.wxid !== actor.current || !members.length
      || !selectedContactSourcesValid(selected, live.contacts, live.user.wxid)) return;
    claimed.current = true;
    const id = members.length === 1 ? members[0].wxid : live.createLocalGroup(members, actor.current, t.group_label);
    if (!id) {claimed.current = false; return;}
    if (owns() && useWechatStore.getState().user.wxid === actor.current) go('startGroup.created.open', {id});
  };
  return <div className="wechat-start-group absolute inset-0 z-[100] bg-app-bg flex flex-col">
    <div className="pt-10 h-(--app-item-height-88) flex items-center justify-between px-4 bg-(--app-c-misc-divider-light) relative shrink-0">
      <div className="flex-1 flex items-center z-10"><button type="button" {...bindBack<HTMLButtonElement>({stopPropagation: true})} className="flex items-center -ml-2 text-app-text active:opacity-60"><IcNavBack size={dimens.icSizeNav}/></button></div>
      <div className="absolute left-0 right-0 flex h-full min-w-0 items-center justify-center px-16 pointer-events-none"><div className="max-w-full truncate text-center font-medium text-(--app-settings-item-text-size) text-app-text">{t.contacts_start_group}</div></div>
      <div className="flex-1 flex justify-end z-10"><button type="button" disabled={!selected.size || sourceChanged}
        {...bindTap<HTMLButtonElement>({kind: 'action', id: 'startGroup.create.submit'}, {onTrigger: submit})}
        className={`px-3 py-1.5 rounded-[4px] text-[15px] font-medium ${selected.size && !sourceChanged ? 'bg-app-primary text-white' : 'bg-(--app-c-tw-bg-gray-200) text-(--app-c-tw-text-gray-400)'}`}>
        {t.common_done}{selected.size ? ` (${selected.size})` : ''}
      </button></div>
    </div>
    {sourceChanged && <div role="status" className="px-4 py-2 text-sm text-app-text bg-app-surface">
      <span>{t.group_selection_changed}</span>
      <button type="button" {...bindTap<HTMLButtonElement>({kind: 'action', id: 'startGroup.selection.clear'}, {onTrigger: () => {
        if (!owns() || !useWechatStore.getState().auth?.session.loggedIn) return;
        actor.current = useWechatStore.getState().user.wxid; claimed.current = false; setSelected(new Map());
      }})} className="ml-2 text-app-primary">{t.group_selection_reset}</button>
    </div>}
    <div ref={listRef} data-scroll-container="main" data-scroll-direction="vertical" className="flex-1 min-h-0 overflow-y-auto no-scrollbar bg-app-surface">
      <label className="m-2 px-3 bg-app-bg rounded-[4px] h-[36px] flex items-center gap-1.5 text-(--app-c-tw-text-gray-400)">
        <IcSearch size={18}/><input type="search" value={query} aria-label={t.search_section_contacts} placeholder={t.common_search}
          data-action="startGroup.search.input" data-action-type="input" data-action-params={JSON.stringify({value: query})}
          className="min-w-0 flex-1 bg-transparent text-app-text outline-none" onChange={event => {
            if (!owns() || claimed.current) return; const next = new URLSearchParams(params);
            if (event.target.value) next.set('q', event.target.value); else next.delete('q'); setParams(next, {replace: true});
          }}/>
      </label>
      {!query && <>
        <div className="px-4 py-3.5 text-(--app-settings-item-text-size) text-(--app-c-settings-item-extra-text)">{t.contacts_start_group_pick_existing}</div>
        <div className="px-4 py-1 text-xs text-(--app-c-tw-text-gray-500) bg-app-bg">{t.contacts_start_group_create_new}</div>
        <button type="button" {...bindTap<HTMLButtonElement>('startGroup.faceToFace.open')}
          className="w-full text-left px-4 py-3.5 border-b border-(--app-c-tw-border-gray-100) text-(--app-settings-item-text-size) text-app-text">{t.contacts_start_group_face_to_face}</button>
        <div className="px-4 py-3.5 text-(--app-settings-item-text-size) text-(--app-c-settings-item-extra-text)">{t.contacts_start_group_pick_from_group}</div>
      </>}
      {categories.map(category => <section key={category} data-start-group-section={category} ref={node => { if (node) sections.current.set(category, node); else sections.current.delete(category); }}>
        <div className="px-4 py-1 text-xs text-(--app-c-tw-text-gray-500) bg-app-bg">{category}</div>
        {groups.get(category)!.map(contact => <button type="button" key={contact.wxid} role="checkbox" aria-checked={selected.has(contact.wxid)} aria-label={contact.name}
          {...bindTap<HTMLButtonElement>({kind: 'action', id: 'startGroup.members.item.toggle'}, {params: {wxid: contact.wxid}, onTrigger: () => toggle(contact)})}
          className="w-full text-left flex items-center px-4 pr-8 py-2.5 border-b border-(--app-c-tw-border-gray-100) bg-app-surface text-app-text">
          <span aria-hidden="true" className={`w-[22px] h-[22px] rounded-full border mr-4 flex items-center justify-center shrink-0 ${selected.has(contact.wxid) ? 'bg-app-primary border-app-primary text-white' : 'border-(--app-c-tw-border-gray-300)'}`}>{selected.has(contact.wxid) ? '✓' : ''}</span>
          <img src={contact.avatar} alt="" className="w-10 h-10 rounded-[4px] shrink-0 object-cover"/>
          <span className="ml-3 min-w-0 truncate text-(--app-settings-item-text-size)" title={contact.name}>{contact.name}</span>
        </button>)}
      </section>)}
      {query && !count && <div className="p-6 text-center text-(--app-c-settings-item-extra-text)">{t.search_no_results}</div>}
    </div>
    <nav aria-label={t.contacts_index} className="absolute right-0 top-32 bottom-20 flex flex-col justify-between items-center text-[10px] text-(--app-c-tw-text-gray-500) w-6">
      <button type="button" className="w-full" data-start-group-index="top" aria-label={t.contacts_index_top}
        {...bindTap<HTMLButtonElement>({kind: 'action', id: 'startGroup.index.jump'}, {params: {category: 'top'}, onTrigger: () => jump('top')})}>↑</button>
      {'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('').map(letter => <button type="button" className="w-full disabled:opacity-30" key={letter} data-start-group-index={letter}
        disabled={!groups.has(letter)} aria-label={t.contacts_index_jump.replace('{{letter}}', letter)}
        {...(groups.has(letter) ? bindTap<HTMLButtonElement>({kind: 'action', id: 'startGroup.index.jump'}, {params: {category: letter}, onTrigger: () => jump(letter)}) : {})}>{letter}</button>)}
    </nav>
  </div>;
};
