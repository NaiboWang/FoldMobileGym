import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAppStrings } from '@/os/useAppStrings';
import { IcArrowBack, IcClose, IcComment, IcSearch, IcUpvote } from '../res/icons';
import { useRedditGestures } from '../hooks/useRedditGestures';
import { useRedditStore } from '../state';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { REDDIT_COMMUNITIES } from '../data';
import { getPostsLoadState, preload, subscribePosts } from '../data/loader';
import { useRedditPosts } from '../hooks/useRedditPosts';
import { useSearchMemory } from '../hooks/useSearchMemory';
import { useSearchOwner } from '../hooks/useSearchOwner';
import { buildRedditSearchIndex, readSearchTab, searchHitKey, searchReddit, type SearchHit, type SearchTab } from '../utils/search';
import '../search.css';
import { VirtualPostImage } from '../components/VirtualPostImage';
import { isVirtualPostImage } from '../utils/postImage';

const ROW_HEIGHT = { posts: 156, communities: 82, comments: 180 };
const SEARCH_ACTIONS = {
  all: { input: 'search.query.input', retry: 'search.retry.submit' },
  posts: { input: 'search.posts.query.input', retry: 'search.posts.retry.submit' },
  communities: { input: 'search.communities.query.input', retry: 'search.communities.retry.submit' },
  comments: { input: 'search.comments.query.input', retry: 'search.comments.retry.submit' },
};

export const SearchPage: React.FC = () => {
  const location = useLocation(), params = new URLSearchParams(location.search), routeQuery = params.get('q') ?? '';
  const tab = readSearchTab(params.get('tab')), communityId = params.get('community') ?? '';
  const s = useAppStrings(strings, stringsEn), { bindBack, bindTap, go } = useRedditGestures();
  const backBinding = bindBack<HTMLButtonElement>();
  const posts = useRedditPosts(), comments = useRedditStore(state => state.comments);
  const status = useSyncExternalStore(subscribePosts, getPostsLoadState, getPostsLoadState);
  const owner = useSearchOwner(), positions = useSearchMemory();
  const input = useRef<HTMLInputElement>(null), scroll = useRef<HTMLDivElement>(null), opened = useRef<string | null>(null);
  const [query, setQuery] = useState(routeQuery), pending = useRef<string[]>([]), latestQuery = useRef(query);
  latestQuery.current = query;
  useLayoutEffect(() => {
    const ownCommit = pending.current.lastIndexOf(routeQuery);
    if (ownCommit >= 0) { pending.current.splice(0, ownCommit + 1); return; }
    setQuery(routeQuery);
  }, [routeQuery]);
  const index = useMemo(() => buildRedditSearchIndex(posts, comments, REDDIT_COMMUNITIES), [posts, comments]);
  const hits = useMemo(() => searchReddit(index, query, tab, communityId), [index, query, tab, communityId]);
  const liveHits = useRef(hits); liveHits.current = hits;
  const selectedCommunity = REDDIT_COMMUNITIES.find(community => community.id === communityId);
  const hasQuery = Boolean(query.trim() || communityId);
  const rows: SearchHit[] = hasQuery ? hits : REDDIT_COMMUNITIES.slice(0, 6).map(community => ({ kind: 'communities', community }));
  const virtualizer = useVirtualizer({
    count: rows.length, getScrollElement: () => scroll.current,
    estimateSize: index => ROW_HEIGHT[rows[index].kind], overscan: 4,
    getItemKey: index => searchHitKey(rows[index]),
    initialOffset: positions.get(location.key) ?? 0,
  });
  const remember = () => {
    if (!scroll.current) return;
    positions.set(location.key, scroll.current.scrollTop);
    if (positions.size > 128) positions.delete(positions.keys().next().value!);
  };
  useLayoutEffect(() => {
    if (scroll.current) scroll.current.scrollTop = positions.get(location.key) ?? 0;
    opened.current = null;
  }, [location.key, positions]);
  const initialFocus = useRef(!hasQuery && !positions.has(location.key));
  useEffect(() => {
    if (!initialFocus.current) return;
    initialFocus.current = false;
    if (owner()) input.current?.focus();
  }, [owner]);
  const changeQuery = (value: string) => {
    if (!owner()) return;
    pending.current.push(value); setQuery(value);
    go('search.query.change', { q: value });
  };
  const changeTab = (value: SearchTab) => {
    if (owner() && value !== tab) go('search.tab.switch', { tab: value, q: latestQuery.current });
  };
  const openHit = (hit: SearchHit) => {
    if (!owner() || opened.current === location.key) return;
    const live = liveHits.current.find(candidate => searchHitKey(candidate) === searchHitKey(hit));
    if (hasQuery && live !== hit) return;
    remember(); opened.current = location.key;
    input.current?.blur(); window.__OS__?.keyboard.hide();
    if (hit.kind === 'communities') {
      pending.current = []; setQuery('');
      go('search.community.open', { community: hit.community.id });
    } else {
      go('post.comments.open', { postId: hit.post.id, ...(hit.kind === 'comments' ? { commentId: hit.comment.id } : {}) });
    }
  };
  const tabs: [SearchTab, string][] = [['all', s.search_tab_all], ['posts', s.search_tab_posts], ['communities', s.search_tab_communities], ['comments', s.search_tab_comments]];
  return <section className="reddit-search-page" aria-label={s.search_placeholder} data-reddit-search="true"
    style={Object.fromEntries(Object.entries(ROW_HEIGHT).map(([kind, height]) => ['--reddit-search-' + kind + '-height', height + 'px'])) as React.CSSProperties}>
    <header className="reddit-search-header pt-10">
      <button type="button" {...backBinding} onClick={event => { if (owner()) backBinding.onClick?.(event); }} aria-label={s.search_back}><IcArrowBack size={24} /></button>
      <div className="reddit-search-field"><IcSearch size={20} aria-hidden="true" />
        <input ref={input} type="search" value={query} aria-label={s.search_placeholder} placeholder={s.search_placeholder}
          data-action={SEARCH_ACTIONS[tab].input} data-action-type="input" data-action-params={JSON.stringify({ value: query })}
          onChange={event => changeQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && owner()) event.currentTarget.blur(); }} />
        {query && <button type="button" aria-label={s.search_clear} data-keep-keyboard="true" onPointerDown={event => event.preventDefault()}
          {...bindTap('search.query.change', { params: { q: '' }, onTrigger: () => { changeQuery(''); if (owner()) input.current?.focus(); } })}><IcClose size={18} /></button>}
      </div>
    </header>
    {hasQuery && <nav className="reddit-search-tabs" aria-label={s.search_categories}>{tabs.map(([value, label]) =>
      <button type="button" key={value} aria-current={value === tab ? 'page' : undefined} data-keep-keyboard="true" onPointerDown={event => event.preventDefault()}
        {...bindTap('search.tab.switch', { params: { tab: value, q: query }, onTrigger: () => changeTab(value) })}>{label}</button>)}</nav>}
    <div className="reddit-search-context">
      <p>{s.search_scope}</p>
      {communityId && <button type="button" {...bindTap('search.community.clear', { onTrigger: () => { if (owner()) go('search.community.clear'); } })}>
        {selectedCommunity?.name ?? s.search_unknown_community}<IcClose size={16} aria-hidden="true" /></button>}
      <p role="status">{status === 'error' ? s.search_load_error : status !== 'ready' ? s.search_loading : hasQuery ? s.search_count.replace('{{count}}', String(hits.length)) : s.search_suggestions}</p>
    </div>
    <div ref={scroll} className="reddit-search-results" data-scroll-container="main" data-scroll-direction="vertical" onScroll={remember}
      data-search-tab={tab} data-search-count={status === 'ready' && hasQuery ? hits.length : 0}>
      {status === 'error' ? <div className="reddit-search-empty"><p>{s.search_load_error}</p><button type="button"
        {...bindTap({ kind: 'action', id: SEARCH_ACTIONS[tab].retry }, { onTrigger: () => { if (owner()) void preload().catch(() => {}); } })}>{s.search_retry}</button></div>
        : status !== 'ready' ? null
          : hasQuery && !hits.length ? <div className="reddit-search-empty"><strong>{s.search_no_results}</strong><p>{s.search_try_other}</p></div>
            : <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>{virtualizer.getVirtualItems().map(item => {
              const hit = rows[item.index];
              const binding = hit.kind === 'communities'
                ? bindTap('search.community.open', { params: { community: hit.community.id }, onTrigger: () => openHit(hit) })
                : bindTap('post.comments.open', { params: { postId: hit.post.id, ...(hit.kind === 'comments' ? { commentId: hit.comment.id } : {}) }, onTrigger: () => openHit(hit) });
              return <div key={item.key} ref={virtualizer.measureElement} data-index={item.index}
                style={{ position: 'absolute', width: '100%', top: 0, left: 0, transform: 'translateY(' + item.start + 'px)' }}>
                <button type="button" className={'reddit-search-hit reddit-search-' + hit.kind} data-search-hit={hit.kind} data-search-id={hit.kind === 'comments' ? hit.comment.id : hit.kind === 'posts' ? hit.post.id : hit.community.id}
                  data-keep-keyboard="true" onPointerDown={event => event.preventDefault()} {...binding}>
                  {hit.kind === 'communities' ? <>
                    <span className="reddit-search-avatar" aria-hidden="true">r{hit.community.icon && <img src={hit.community.icon} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />}</span>
                    <span className="reddit-search-copy"><strong>{hit.community.name}</strong><small>{hit.community.members} {s.search_members}</small></span><IcSearch size={18} aria-hidden="true" />
                  </> : <>
                    <span className="reddit-search-copy"><small>{hit.post.subreddit} · {hit.kind === 'comments' ? hit.comment.author : hit.post.author}</small>
                      <strong>{hit.post.title}</strong>
                      {hit.kind === 'comments' ? <span className="reddit-search-snippet">{hit.comment.body}</span> : <span className="reddit-search-snippet">{hit.post.content}</span>}
                      <small className="reddit-search-metrics"><IcUpvote size={15} aria-hidden="true" />{hit.kind === 'comments' ? hit.comment.score ?? 0 : hit.post.upvotes}<IcComment size={15} aria-hidden="true" />{hit.kind === 'comments' ? s.search_tab_comments : hit.post.comments}</small>
                    </span>
                    {hit.kind === 'posts' && hit.post.image && (isVirtualPostImage(hit.post.image)
                      ? <VirtualPostImage className="reddit-search-thumbnail" source={hit.post.image} />
                      : <img className="reddit-search-thumbnail" src={hit.post.image} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />)}
                  </>}
                </button>
              </div>;
            })}</div>}
    </div>
  </section>;
};
