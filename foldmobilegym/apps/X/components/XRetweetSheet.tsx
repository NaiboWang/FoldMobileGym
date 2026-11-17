import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { IcRepost, IcCompose, IcBarChart } from '../res/icons';
import { useXStrings } from '../hooks/useXStrings';
import { useXGestures } from '../hooks/useXGestures';
import { useXOverlayControls } from '../hooks/useXOverlayControls';
import { useXBaseDataset } from '../data/view';
import { getXBaseDataset, preload } from '../data/loader';
import { useXStore } from '../state';
import { getXSheet } from '../utils/overlayState';
import { getXOverlayPostSource } from '../utils/overlayPostSource';
import { XSheetFrame } from './XSheetFrame';
import type { XPost } from '../types';

export const XRetweetSheet: React.FC = () => {
  const location = useLocation(), params = new URLSearchParams(location.search);
  const isOpen = getXSheet(location.pathname, location.search) === 'retweet', postId = params.get('sheetPostId') || '';
  const posts = useXStore(state => state.posts), userId = useXStore(state => state.user.id);
  const retweeted = useXStore(state => state.user.retweetedPostIds).includes(postId);
  const base = useXBaseDataset(), source = isOpen ? getXOverlayPostSource(posts, base, postId) : null;
  const owner = useRef<{ key: string; source: XPost | null; postId: string; userId: string; resolved: boolean } | null>(null);
  if (isOpen && owner.current?.key !== location.key) owner.current = { key: location.key, source, postId, userId, resolved: !!source || !postId };
  if (isOpen && owner.current && !owner.current.resolved && source) { owner.current.source = source; owner.current.resolved = true; }
  const available = !!source && owner.current?.source === source && owner.current?.userId === userId;
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    let live = true;
    const entry = owner.current;
    if (!isOpen || !entry || entry.resolved || source || !postId) { setSettled(true); return; }
    setSettled(false);
    const finish = () => {
      if (!live || owner.current !== entry) return;
      // Resolve once after authoritative loading; an unavailable entry cannot later rebind to a replacement.
      entry.source = getXOverlayPostSource(useXStore.getState().posts, getXBaseDataset(), postId);
      entry.resolved = true; setSettled(true);
    };
    void Promise.all([preload(), useXStore.getState().ensureRepliesLoaded()]).then(finish, finish);
    return () => { live = false; };
  }, [location.key, isOpen, postId, source]);
  const { bindTap, go, back } = useXGestures(), { claim } = useXOverlayControls(), s = useXStrings();
  if (!isOpen) return null;
  const claimTarget = () => available && getXOverlayPostSource(useXStore.getState().posts, getXBaseDataset(), postId) === owner.current?.source
    && useXStore.getState().user.id === owner.current?.userId && claim();
  const retweet = () => {
    if (useXStore.getState().user.retweetedPostIds.includes(postId) !== retweeted || !claimTarget()) return;
    useXStore.getState().toggleRetweet(postId); back();
  };
  const confirm = location.pathname === '/' ? (params.get('tab') === 'following'
    ? bindTap({ kind: 'action', id: 'home.following.post.retweet' }, { params: { id: postId }, onTrigger: retweet })
    : bindTap({ kind: 'action', id: 'home.foryou.post.retweet' }, { params: { id: postId }, onTrigger: retweet }))
    : location.pathname === '/profile' ? bindTap({ kind: 'action', id: 'profile.post.retweet' }, { params: { id: postId }, onTrigger: retweet })
    : location.pathname === '/search/input' ? bindTap({ kind: 'action', id: 'search.post.retweet' }, { params: { id: postId }, onTrigger: retweet })
    : location.pathname.startsWith('/user/') ? bindTap({ kind: 'action', id: 'userProfile.post.retweet' }, { params: { id: postId }, onTrigger: retweet })
    : bindTap({ kind: 'action', id: 'post.item.retweet' }, { params: { id: postId }, onTrigger: retweet });
  const button = 'w-full flex items-center p-4 rounded-xl text-left active:bg-app-surface disabled:opacity-40';
  return <XSheetFrame kind="retweet" title={s.retweet_sheet_retweet}>
    {!available && <div role="status" className="p-3 text-sm text-gray-500">{!settled ? s.post_loading_replies : s.post_not_found}</div>}
    <button type="button" disabled={!available} {...confirm} className={button}><IcRepost size={24} className="mr-4" /><span className="font-bold text-lg">{retweeted ? s.retweet_sheet_undo : s.retweet_sheet_retweet}</span></button>
    <button type="button" disabled={!available} {...bindTap('compose.open', { params: { quotedPostId: postId }, onTrigger: () => {
      if (claimTarget()) go('compose.open', { quotedPostId: postId }, { consumeSheet: true });
    } })} className={button}><IcCompose size={24} className="mr-4" /><span className="font-bold text-lg">{s.retweet_sheet_quote}</span></button>
    <button type="button" disabled={!available} {...bindTap('status.activity.open', { params: { id: postId }, onTrigger: () => {
      if (claimTarget()) go('status.activity.open', { id: postId }, { consumeSheet: true });
    } })} className={button}><IcBarChart size={24} className="mr-4" /><span className="font-bold text-lg">{s.retweet_sheet_view_activity}</span></button>
  </XSheetFrame>;
};
