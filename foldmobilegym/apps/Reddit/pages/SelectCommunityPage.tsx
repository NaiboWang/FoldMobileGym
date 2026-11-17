import React, { useState, useMemo, useRef } from 'react';
import { useAppStrings } from '@/os/useAppStrings';
import { IcClose, IcSearch } from '../res/icons';
import { useRedditGestures } from '../hooks/useRedditGestures';
import { useRedditStore, type CreateDraftCommunity } from '../state';
import { useRedditRouteOwner } from '../hooks/useRedditRouteOwner';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

export interface CommunityInfo {
  id: string;
  name: string;
  members: string;
  description: string;
  iconBg: string;
  iconText: string;
  iconTextColor: string;
  recentlyVisited?: boolean;
}

export const COMMUNITIES: CommunityInfo[] = [
  {
    id: 'china_irl',
    name: 'r/China_irl',
    members: '396k members',
    description: '一个以相互尊重为基础、提倡求同存异的中文社区。我们欢迎大家友善地讨论历史、生物、科技、人文…',
    iconBg: 'bg-gray-200',
    iconText: '',
    iconTextColor: '',
    recentlyVisited: true,
  },
  {
    id: 'games',
    name: 'r/Games',
    members: '3.5m members',
    description: 'The goal of /r/Games is to provide a place for informative and interesting gaming content and di…',
    iconBg: 'bg-black',
    iconText: 'G',
    iconTextColor: 'text-white',
  },
  {
    id: 'music',
    name: 'r/Music',
    members: '38.3m members',
    description: "Reddit's #1 Music Community",
    iconBg: 'bg-purple-200',
    iconText: '🎧',
    iconTextColor: '',
  },
  {
    id: 'otherside',
    name: 'r/OtherSide',
    members: '568 members',
    description: 'n',
    iconBg: 'bg-orange-500',
    iconText: 'r/',
    iconTextColor: 'text-white',
  },
];

export const SelectCommunityPage: React.FC = () => {
  const { bindBack, bindTap, back, go, canGoBack } = useRedditGestures();
  const s = useAppStrings(strings, stringsEn), owner = useRedditRouteOwner('/create/community');
  const claimed = useRef(false), actor = useRef(useRedditStore.getState().user.username);
  const ownsSelection = () => owner() && !claimed.current && actor.current === useRedditStore.getState().user.username;
  const closeBinding = bindBack<HTMLButtonElement>();
  const selectCommunity = useRedditStore((s) => s.selectCommunity);
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return COMMUNITIES;
    const q = searchQuery.toLowerCase();
    return COMMUNITIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  const handleSelect = (community: CommunityInfo) => {
    if (!ownsSelection() || !COMMUNITIES.includes(community)) return;
    claimed.current = true;
    const draft: CreateDraftCommunity = {
      id: community.id,
      name: community.name,
      iconBg: community.iconBg,
      iconText: community.iconText,
      iconTextColor: community.iconTextColor,
    };
    selectCommunity(draft);
    document.activeElement instanceof HTMLElement && document.activeElement.blur(); window.__OS__?.keyboard.hide();
    if (canGoBack('/create')) back(); else go('create.editor.return');
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-app-surface" data-reddit-community-picker="true">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 pt-10 pb-3">
        <button type="button" {...closeBinding} onClick={event => { if (owner()) closeBinding.onClick?.(event); }} aria-label={s.search_back} className="p-1">
          <IcClose className="w-6 h-6 text-gray-700" />
        </button>
        <span className="text-lg font-bold text-app-text">{s.create_post_to}</span>
      </div>

      {/* Search bar */}
      <div className="px-4 pb-3">
        <div className="flex items-center bg-gray-100 rounded-xl px-4 py-3">
          <input
            type="text"
            placeholder={s.create_community_search}
            aria-label={s.create_community_search}
            data-action="create.community.query.input" data-action-type="input" data-action-params={JSON.stringify({ value: searchQuery })}
            value={searchQuery}
            onChange={(e) => { if (ownsSelection()) setSearchQuery(e.target.value); }}
            className="flex-1 min-w-0 bg-transparent text-base text-gray-800 placeholder-gray-400 outline-none"
          />
          <IcSearch className="w-5 h-5 text-gray-400 ml-2 shrink-0" />
        </div>
      </div>

      {/* Community list */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar" data-scroll-container="main" data-scroll-direction="vertical">
        {filtered.map((community) => (
          <button
            key={community.id}
            className="flex items-start gap-3 w-full px-4 py-3 text-left active:bg-gray-50"
            {...bindTap({ kind: 'action', id: 'create.community.item.submit' }, { params: { communityId: community.id }, onTrigger: () => handleSelect(community) })}
          >
            {/* Community icon */}
            <div
              className={`w-12 h-12 rounded-full ${community.iconBg} flex items-center justify-center shrink-0`}
            >
              {community.iconText && (
                <span className={`text-lg font-bold ${community.iconTextColor}`}>
                  {community.iconText}
                </span>
              )}
            </div>

            {/* Community info */}
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-app-text">{community.name}</p>
              <p className="text-sm text-app-text-muted">
                {community.members}
                {community.recentlyVisited && ' · recently visited'}
              </p>
              <p className="text-sm text-app-text-muted mt-0.5 line-clamp-2">
                {community.description}
              </p>
            </div>
          </button>
        ))}

        {filtered.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <span className="text-gray-400 text-base">No communities found</span>
          </div>
        )}
      </div>
    </div>
  );
};
