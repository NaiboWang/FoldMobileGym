import React from 'react';
import { IcTabHome, IcTabCreate, IcTabChat, IcTabInbox } from '../res/icons';
import { useLocation } from 'react-router-dom';
import { useRedditGestures } from '../hooks/useRedditGestures';
import { RedditPngIcon } from '../RedditPngIcon';
const asset = (r: unknown) => { const s = String(r ?? '').trim(); return (!s || s.startsWith('http')) ? s : `/@app-assets/Reddit/${s}`; };

const ANSWERS_TAB_ICON_SRC = asset('tabbar/answers.png');

type NavigationVariant = 'bottom' | 'rail';

const RedditPrimaryNavigation: React.FC<{ variant: NavigationVariant }> = ({ variant }) => {
  const { pathname } = useLocation();
  const { bindTap } = useRedditGestures();
  const rail = variant === 'rail';

  const getIconColor = (isActive: boolean) => isActive ? 'text-black' : 'text-app-text-muted';
  const getLabelClass = (isActive: boolean) => rail
    ? 'sr-only'
    : `text-[10px] mt-1 ${isActive ? 'text-black font-medium' : 'text-app-text-muted'}`;
  const itemClass = (isActive: boolean) => rail
    ? `flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl touch-manipulation transition-colors ${isActive ? 'bg-[#e7e8ea]' : 'active:bg-gray-100'}`
    : 'flex flex-1 flex-col items-center justify-center rounded-lg py-1 touch-manipulation transition-colors active:bg-gray-100';

  const isHome = pathname === '/';
  const isCommunities = pathname === '/communities';
  const isCreate = pathname === '/create';
  const isChat = pathname === '/chat';
  const isInbox = pathname === '/inbox';

  return (
    <nav
      aria-label="Reddit primary navigation"
      data-reddit-navigation={variant}
      className={rail
        ? 'reddit-primary-rail relative z-[100] shrink-0 flex-col items-center border-r border-app-border bg-app-surface px-2 pb-4 pt-14'
        : 'reddit-primary-bottom relative z-[100] shrink-0 items-center justify-between border-t border-app-border bg-app-surface px-2 py-2 pb-5 shadow-[0_-1px_3px_rgba(0,0,0,0.05)]'}
    >
      {rail && <div data-reddit-rail-brand className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-[#ff4500]/10" aria-hidden="true"><RedditPngIcon className="h-8 w-8" /></div>}
      {/* Home */}
      <button type="button" aria-label="Home"
        {...bindTap('tab.home')}
        className={itemClass(isHome)}
      >
        <IcTabHome
          className={`w-6 h-6 ${getIconColor(isHome)} ${isHome ? 'fill-black' : ''}`}
          strokeWidth={2}
        />
        <span className={getLabelClass(isHome)}>Home</span>
      </button>

      {/* Communities */}
      <button type="button" aria-label="Answers"
        {...bindTap('tab.communities')}
        className={itemClass(isCommunities)}
      >
        <img
          src={ANSWERS_TAB_ICON_SRC}
          alt="Answers"
          className="w-9 h-9 object-contain"
          draggable={false}
          style={{
            opacity: isCommunities ? 1 : 0.55,
            filter: isCommunities ? 'none' : 'grayscale(1)',
          }}
          onError={(e) => {
            // if missing asset, don't show a broken icon
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
        <span className={getLabelClass(isCommunities)}>Answers</span>
      </button>

      {/* Create */}
      <button type="button" aria-label="Create"
        {...bindTap('tab.create')}
        className={itemClass(isCreate)}
      >
        <IcTabCreate className="w-8 h-8 text-app-text-muted font-light" strokeWidth={1.5} />
        <span className={getLabelClass(isCreate)}>Create</span>
      </button>

      {/* Chat */}
      <button type="button" aria-label="Chat"
        {...bindTap('tab.chat')}
        className={itemClass(isChat)}
      >
        <IcTabChat
          className={`w-6 h-6 ${getIconColor(isChat)} ${isChat ? 'fill-black' : ''}`}
          strokeWidth={2}
        />
        <span className={getLabelClass(isChat)}>Chat</span>
      </button>

      {/* Inbox */}
      <button type="button" aria-label="Inbox"
        {...bindTap('tab.inbox')}
        className={itemClass(isInbox)}
      >
        <IcTabInbox
          className={`w-6 h-6 ${getIconColor(isInbox)} ${isInbox ? 'fill-black' : ''}`}
          strokeWidth={2}
        />
        <span className={getLabelClass(isInbox)}>Inbox</span>
      </button>
    </nav>
  );
};

export const BottomTabBar: React.FC = () => <RedditPrimaryNavigation variant="bottom" />;
export const NavigationRail: React.FC = () => <RedditPrimaryNavigation variant="rail" />;
