import React from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useXStore, selectEffectiveFollowedSet } from '../state';
import { useXPostActivity, useXResolvedPost } from '../data/view';
import { useXGestures } from '../hooks/useXGestures';
import { XImage } from '../components/XMedia';
import { useXStrings } from '../hooks/useXStrings';
import { IcSort, IcCheck } from '../res/icons';
import { useXOverlayControls } from '../hooks/useXOverlayControls';
import { getXSheet } from '../utils/overlayState';
import { XSheetFrame } from '../components/XSheetFrame';
import { XDataNotice } from '../components/XDataNotice';
import { useXPostData } from '../hooks/useXPostData';
import { useVirtualList } from '../../../os/hooks/useVirtualList';
import { orderXQuotes } from '../utils/postOrdering';

type ActivityRow = { id: string; kind: 'quote'; post: any } | { id: string; kind: 'actor'; actor: ReturnType<typeof useXPostActivity>['reposters'][number] };
export const PostActivityPage: React.FC = () => {
  const { id = '' } = useParams(), post = useXResolvedPost(id), activity = useXPostActivity(id), data = useXPostData(id);
  const userId = useXStore(state => state.user.id), followedSet = useXStore(selectEffectiveFollowedSet);
  const { bindBack, bindTap, go, back } = useXGestures(), s = useXStrings();
  const location = useLocation(), { openOnce, claim, isCurrent } = useXOverlayControls();
  const activeTab = new URLSearchParams(location.search).get('tab') === 'retweets' ? 'retweets' : 'quotes';
  const showSortMenu = getXSheet(location.pathname, location.search) === 'quoteSort';
  const [sortMethod, setSortMethod] = React.useState<'popular' | 'recent'>('popular');
  const quotes = React.useMemo(() => orderXQuotes(activity.quotes, sortMethod), [activity.quotes, sortMethod]);
  const rows = React.useMemo<ActivityRow[]>(() => activeTab === 'quotes'
    ? quotes.map(post => ({ kind: 'quote', id: post.id, post }))
    : activity.reposters.map(actor => ({ kind: 'actor', id: actor.id, actor })), [quotes, activity.reposters, activeTab]);
  const { parentRef, virtualizer, virtualItems, totalSize } = useVirtualList({ items: rows,
    estimateSize: (_, row) => row.kind === 'quote' ? 230 : 110, overscan: 4, getItemKey: (_, row) => row.kind + ':' + row.id });
  React.useEffect(() => { parentRef.current?.scrollTo({ top: 0 }); virtualizer.scrollToOffset(0); }, [id, activeTab, parentRef, virtualizer]);
  const selectSort = (method: 'popular' | 'recent') => { if (!showSortMenu || !claim()) return; setSortMethod(method); back(); };
  const sortOptions = [
    { value: 'popular', label: s.post_sort_popular, props: bindTap({ kind: 'action', id: 'status.activity.sort.select.popular' }, { params: { id }, onTrigger: () => selectSort('popular') }) },
    { value: 'recent', label: s.post_sort_recent, props: bindTap({ kind: 'action', id: 'status.activity.sort.select.recent' }, { params: { id }, onTrigger: () => selectSort('recent') }) },
  ];
  const retryProps = activeTab === 'quotes'
    ? bindTap({ kind: 'action', id: 'status.activity.data.retry.submit' }, { onTrigger: data.retry })
    : bindTap({ kind: 'action', id: 'status.activity.retweets.retry.submit' }, { onTrigger: data.retry });
  if (!post) return <div className="flex flex-col bg-app-bg min-h-full text-app-text pt-10 px-4">
    <header className="flex items-center py-2"><button className="mr-4" {...bindBack()}>←</button><h1 className="font-bold text-lg">{s.post_activity_title}</h1></header>
    <XDataNotice {...data} retryProps={retryProps} />{data.ready && <p data-x-post-unavailable className="mt-6 text-gray-500">{s.post_not_found}</p>}
  </div>;
  return <div className="relative h-full">
    <div data-x-page-background inert={showSortMenu} className="flex h-full min-h-0 flex-col bg-app-bg text-app-text pt-10">
      <header className="flex items-center px-4 py-2 border-b border-app-border shrink-0 bg-app-bg">
        <button className="mr-6" {...bindBack()}><svg viewBox="0 0 24 24" aria-hidden="true" className="w-5 h-5 fill-current"><g><path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" /></g></svg></button><h1 className="font-bold text-lg">{s.post_activity_title}</h1>
        {activeTab === 'quotes' && <button className="ml-auto p-2" {...bindTap('status.activity.sort.open', { params: { id }, onTrigger: () => openOnce(() => go('status.activity.sort.open', { id })) })} aria-label={s.post_sort_quotes}><IcSort size={20} /></button>}
      </header>
      <div className="flex border-b border-app-border shrink-0" role="tablist">
        <button className={`flex-1 py-4 font-bold text-sm relative hover:bg-black/5 transition-colors ${activeTab === 'quotes' ? 'text-app-text' : 'text-gray-500'}`}
          role="tab" aria-selected={activeTab === 'quotes'} {...bindTap('status.activity.tab.switch', { params: { id, tab: 'quotes' }, onTrigger: () => { if (activeTab !== 'quotes') openOnce(() => go('status.activity.tab.switch', { id, tab: 'quotes' })); } })}>{s.retweet_sheet_quote}{activeTab === 'quotes' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-blue-500 rounded-full" />}</button>
        <button className={`flex-1 py-4 font-bold text-sm relative hover:bg-black/5 transition-colors ${activeTab === 'retweets' ? 'text-app-text' : 'text-gray-500'}`}
          role="tab" aria-selected={activeTab === 'retweets'} {...bindTap('status.activity.tab.switch', { params: { id, tab: 'retweets' }, onTrigger: () => { if (activeTab !== 'retweets') openOnce(() => go('status.activity.tab.switch', { id, tab: 'retweets' })); } })}>{s.retweet_sheet_retweet}{activeTab === 'retweets' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-blue-500 rounded-full" />}</button>
      </div>
      <p className="text-xs text-gray-500 px-4 py-2 shrink-0" data-x-activity-scope>{s.post_activity_scope}</p>
      <XDataNotice {...data} retryProps={retryProps} />
      <div ref={parentRef} className="flex-1 min-h-0 overflow-y-auto no-scrollbar" data-scroll-container="main" data-scroll-direction="vertical">
        {data.ready && rows.length === 0 && <p data-x-activity-empty className="p-8 text-center text-gray-500">{activeTab === 'quotes' ? s.post_no_quotes : s.post_no_reposters}</p>}
        {data.ready && <div style={{ height: totalSize, position: 'relative', width: '100%' }}>
          {virtualItems.map(item => {
            const row = rows[item.index]; if (!row) return null;
            return <div key={item.key} ref={virtualizer.measureElement} data-index={item.index}
              data-x-activity-row={row.id} data-x-activity-kind={row.kind}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${item.start}px)` }}>
              {row.kind === 'quote' ? <div className="border-b border-app-border p-4 cursor-pointer active:bg-app-surface" {...bindTap('status.open', { params: { id: row.post.id } })}>
                <div className="flex gap-3"><div className="w-10 h-10 rounded-full bg-app-surface overflow-hidden shrink-0">
                  {row.post.author?.avatar && <XImage src={row.post.author.avatar} alt={row.post.author.name || ''} className="w-full h-full object-cover" />}
                </div><div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-500 flex gap-1 flex-wrap"><strong className="text-app-text">{row.post.author?.name}</strong>{row.post.author?.verified && <span className="text-blue-400">✓</span>}<span>@{row.post.authorId}</span><span>· {row.post.time}</span></div>
                  <p className="mt-1 whitespace-pre-wrap break-words">{row.post.content}</p>
                  <div className="mt-3 rounded-xl border border-app-border p-3"><div className="text-sm font-bold">{post.author?.name} <span className="text-gray-500 font-normal">@{post.authorId}</span></div><p className="text-sm mt-1 line-clamp-3 whitespace-pre-wrap break-words">{post.content}</p></div>
                </div></div>
              </div> : <div className="flex items-start gap-3 border-b border-app-border p-4">
                <button type="button" className="flex gap-3 flex-1 min-w-0 text-left" {...bindTap('user.open.fromPost', { params: { id: row.actor.id } })}>
                  <div className="w-10 h-10 rounded-full bg-app-surface shrink-0 overflow-hidden">{row.actor.user?.avatar && <XImage src={row.actor.user.avatar} alt={row.actor.user.name} className="w-full h-full object-cover" />}</div>
                  <div className="min-w-0"><div className="font-bold break-words">{row.actor.user?.name ?? s.post_user_unavailable}{row.actor.user?.verified && <span className="text-blue-400 ml-1">✓</span>}</div><div className="text-sm text-gray-500 break-all">@{row.actor.id}</div>{row.actor.user?.bio && <p className="text-sm mt-1 line-clamp-2">{row.actor.user.bio}</p>}</div>
                </button>
                {row.actor.user && row.actor.id !== userId && <button type="button" className="rounded-full border border-app-border px-4 py-1.5 font-bold text-sm shrink-0"
                  {...bindTap({ kind: 'action', id: 'user.item.follow' }, { params: { id: row.actor.id }, onTrigger: () => { if (isCurrent()) useXStore.getState().toggleFollow(row.actor.id); } })}>
                  {followedSet.has(row.actor.id) ? s.connections_following_button : s.connections_follow_button}
                </button>}
              </div>}
            </div>;
          })}
        </div>}
      </div>
    </div>
    {showSortMenu && <XSheetFrame kind="quoteSort" title={s.post_sort_quotes}><div role="radiogroup">{sortOptions.map(option => <button type="button" role="radio" aria-checked={sortMethod === option.value} key={option.value} {...option.props} className="w-full flex items-center justify-between p-4 rounded-xl active:bg-app-surface"><span className="font-bold text-lg">{option.label}</span>{sortMethod === option.value && <IcCheck size={20} className="text-blue-500" />}</button>)}</div></XSheetFrame>}
  </div>;
};
