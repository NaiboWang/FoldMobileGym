import React from 'react';
import { useLocation } from 'react-router-dom';
import { useActivityId } from '../../os/ActivityContext';
import { useAppStrings } from '../../os/useAppStrings';
import { useBrowserStore, selectActiveTab } from './state';
import { useBrowserGestures } from './hooks/useBrowserGestures';
import { strings } from './res/strings';
import { stringsEn } from './res/strings.en';
import { IcBookmark } from './res/icons';

export const BookmarkButton: React.FC = () => {
  const tab = useBrowserStore(selectActiveTab), bookmarks = useBrowserStore(state => state.bookmarks);
  const save = useBrowserStore(state => state.bookmarkTab), { bindTap } = useBrowserGestures();
  const location = useLocation(), activityId = useActivityId(), s = useAppStrings(strings, stringsEn);
  const available = location.pathname === '/view' && !location.search && Boolean(tab.url);
  const saved = Boolean(bookmarks?.[tab.url]);
  return <button type="button" disabled={!available} aria-label={saved ? s.bookmark_saved : s.bookmark_add}
    aria-pressed={saved} title={saved ? s.bookmark_saved : s.bookmark_add}
    className="w-12 h-12 flex items-center justify-center text-slate-500 disabled:opacity-40 rounded-full"
    {...bindTap({ kind: 'action', id: 'browser.bookmark.add' }, { params: { tabId: tab.id, url: tab.url }, onTrigger: () => {
      const os = window.__OS__?.getState(), top = os?.tasks.find(task => task.taskId === os.activeTaskId)?.stack.at(-1);
      if (available && top?.activityId === activityId && !os?.isLauncherVisible && !os?.isRecentsVisible) save(tab.id, tab.url);
    } })}><IcBookmark size={24} fill={saved ? 'currentColor' : 'none'} /></button>;
};
