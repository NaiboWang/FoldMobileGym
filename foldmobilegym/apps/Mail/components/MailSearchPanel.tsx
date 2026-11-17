import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useVirtualList } from '@/os/hooks/useVirtualList';
import { useTriggerGestures } from '@/os/hooks/useTriggerGestures';
import { useAppStrings } from '@/os/useAppStrings';
import { useMailNavigate } from '../navigation';
import { useMailStore } from '../state';
import { useMailSurfaceOwner } from '../hooks/useMailSurfaceOwner';
import { mailSearchRoute } from '../searchRouting';
import { canUseReplySurface } from '../replyDrafts';
import { searchMail, type MailSearchHit } from '../search';
import type { Draft, Message } from '../types';
import { IcMailBack, IcMailSearch, IcRemoveAttachment, IcMailStar } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

export function MailSearchPanel({ messages, drafts }: { messages: Message[]; drafts: Draft[] }) {
  const location = useLocation(), route = mailSearchRoute(location.pathname), routeQuery = new URLSearchParams(location.search).get('q') ?? '';
  const [query, setQuery] = useState(routeQuery), pendingQueries = useRef<string[]>([]);
  const latestQuery = useRef(query); latestQuery.current = query;
  useLayoutEffect(() => {
    const index = pendingQueries.current.lastIndexOf(routeQuery);
    if (index >= 0) {
      pendingQueries.current.splice(0, index + 1);
      if (routeQuery === latestQuery.current) pendingQueries.current = [];
      return;
    }
    setQuery(routeQuery);
  }, [routeQuery]);
  const previousPath = useRef(location.pathname);
  useLayoutEffect(() => {
    if (previousPath.current === location.pathname) return;
    previousPath.current = location.pathname; pendingQueries.current = []; setQuery(routeQuery);
  }, [location.pathname, routeQuery]);
  const { go, replaceSearchQuery } = useMailNavigate(), s = useAppStrings(strings, stringsEn), isCurrent = useMailSurfaceOwner();
  const { bindTap } = useTriggerGestures(), openedKey = useRef<string | null>(null);
  useEffect(() => { if (openedKey.current !== location.key) openedKey.current = null; }, [location.key]);
  const starredIds = useMailStore(state => state.starredIds);
  const archivedIds = useMailStore(state => state.archivedIds);
  const unreadIds = useMailStore(state => state.unreadIds);
  const result = useMemo(() => searchMail(messages, drafts, query, starredIds, archivedIds, unreadIds ?? []), [messages, drafts, query, starredIds, archivedIds, unreadIds]);
  const { parentRef, virtualizer, virtualItems, totalSize } = useVirtualList({ items: result.hits, estimateSize: () => 90, overscan: 4, getItemKey: (_index, hit) => JSON.stringify([hit.kind, hit.id]) });
  const changeQuery = (value: string) => {
    // Own query-only history commits must not reject a newer native input event.
    if (!isCurrent(true)) return;
    pendingQueries.current.push(value); setQuery(value); openedKey.current = null; parentRef.current?.scrollTo({ top: 0 }); replaceSearchQuery(value);
  };
  const select = (hit: MailSearchHit) => {
    if (!isCurrent(true) || openedKey.current === location.key) return;
    const current = useMailStore.getState();
    const actual = hit.kind === 'message' ? current.messages.find(item => item.id === hit.id) : current.drafts.find(item => item.id === hit.id);
    if (actual !== hit.source) return;
    if (!searchMail(current.messages, current.drafts, latestQuery.current, current.starredIds, current.archivedIds, current.unreadIds ?? []).hits
      .some(item => item.kind === hit.kind && item.id === hit.id && item.source === hit.source)) return;
    if (hit.kind === 'draft' && hit.source.replyTo && !canUseReplySurface(isCurrent(true), window.__OS__?.getState())) return;
    openedKey.current = location.key;
    window.__OS__?.keyboard.hide();
    if (hit.kind === 'message') {
      current.setUnread(hit.source, false); current.open(hit.id); go('mail.search.message.select', { messageId: hit.id, q: latestQuery.current }, { mode: route.kind === 'message' ? 'replace' : 'push' });
    } else {
      if (hit.source.replyTo) go('mail.search.reply.resume', { messageId: hit.source.replyTo.messageId, q: latestQuery.current });
      else { current.openDraft(hit.id); go('mail.search.draft.select', { draftId: hit.id, q: latestQuery.current }); }
    }
  };
  return <section className="mail-search-panel" aria-label={s.search_mail}>
    <header className="mail-search-header">
      <button type="button" aria-label={s.search_back} {...bindTap('system.back')}><IcMailBack size={21} /></button>
      <div className="mail-search-input"><IcMailSearch size={20} aria-hidden="true" /><input type="search" data-benchmark-field="mail-search" aria-label={s.search_mail}
        {...(route.kind === 'message' ? { 'data-action': 'mail.search.reader.query.input' } : { 'data-action': 'mail.search.query.input' })} data-action-type="input" data-action-params={JSON.stringify({ value: query })}
        value={query} placeholder={s.search_placeholder} onChange={event => changeQuery(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
        {query && <button type="button" aria-label={s.search_clear} data-keep-keyboard="true" onPointerDown={event => event.preventDefault()}
          {...(route.kind === 'message' ? bindTap({ kind: 'action', id: 'mail.search.reader.query.clear' }, { onTrigger: () => changeQuery('') }) : bindTap({ kind: 'action', id: 'mail.search.query.clear' }, { onTrigger: () => changeQuery('') }))}><IcRemoveAttachment size={18} /></button>}
      </div>
    </header>
    <div className="mail-search-intro"><p>{s.search_scope_note}</p><p className="mail-search-help">{s.search_help}</p>
      <p role={result.error ? 'alert' : 'status'}>{result.error ? s.search_invalid : s.search_results_count.replace('{{count}}', String(result.hits.length))}</p>
    </div>
    <div ref={parentRef} className="mail-search-results" data-scroll-container="searchResults" data-scroll-direction="vertical" data-mail-search-count={result.hits.length}>
      {result.error ? null : !result.hits.length ? <div className="mail-search-empty"><strong>{s.search_no_results}</strong><p>{s.search_empty_hint}</p></div> :
        <div style={{ height: totalSize, position: 'relative', width: '100%' }}>{virtualItems.map(item => {
          const hit = result.hits[item.index]; if (!hit) return null;
          const selected = route.kind === hit.kind && route.id === hit.id;
          return <div key={item.key} ref={virtualizer.measureElement} data-index={item.index}
            style={{ position: 'absolute', width: '100%', left: 0, top: 0, transform: `translateY(${item.start}px)` }}>
            <button type="button" className={selected ? 'mrow mail-search-result active' : 'mrow mail-search-result'} aria-current={selected ? 'page' : undefined}
              data-keep-keyboard="true" onPointerDown={event => event.preventDefault()} data-mail-search-kind={hit.kind} data-mail-search-id={hit.id}
              data-mail-unread={hit.kind === 'message' && unreadIds?.includes(hit.id) ? 'true' : undefined}
              {...(hit.kind === 'message'
                ? bindTap('mail.search.message.select', { params: { messageId: hit.id, q: query }, onTrigger: () => select(hit) })
                : hit.source.replyTo
                  ? bindTap('mail.search.reply.resume', { params: { messageId: hit.source.replyTo.messageId, q: query }, onTrigger: () => select(hit) })
                  : bindTap('mail.search.draft.select', { params: { draftId: hit.id, q: query }, onTrigger: () => select(hit) }))}>
              <span className="mail-reference-avatar" aria-hidden="true">{hit.kind === 'message' ? hit.source.from?.trim().slice(0, 1) : s.search_draft_badge.slice(0, 1)}</span>
              <span className="mail-reference-row-copy"><b>{hit.source.subject || s.untitled_draft}</b><span>{hit.kind === 'message' ? hit.source.from : hit.source.to}</span><small>{hit.source.body?.split('\n')[0]}</small></span>
              <small className="mail-search-kind">{hit.kind === 'message' ? s.search_message_badge : s.search_draft_badge}
                {hit.kind === 'message' && unreadIds?.includes(hit.id) && <span className="mail-unread-badge">{s.unread_message}</span>}
                {hit.kind === 'message' && starredIds?.includes(hit.id) && <span className="mail-reference-starred" aria-label={s.starred_message}><IcMailStar size={18} aria-hidden="true" /></span>}
              </small>
            </button>
          </div>;
        })}</div>}
    </div>
  </section>;
}
