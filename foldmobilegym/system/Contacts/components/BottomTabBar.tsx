import React from 'react';
import { useLocation } from 'react-router-dom';
import { Star } from 'lucide-react';
import { useContactsGestures } from '../hooks/useContactsGestures';
import { SymbolIcon } from './SymbolIcon';
import { IcSymbolContactsCircle, IcSymbolPhone } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';

type TabKey = 'calls' | 'contacts' | 'favorites';

function getActiveTab(pathname: string, search: string): TabKey {
  if (pathname === '/contacts' && new URLSearchParams(search).get('fav') === 'true') return 'favorites';
  if (pathname.startsWith('/contacts') || pathname.startsWith('/contact/')) return 'contacts';
  if (pathname.startsWith('/settings')) return 'calls'; // keep dialer selected in settings
  return 'calls';
}

export const BottomTabBar: React.FC = () => {
  const { bindTap } = useContactsGestures();
  const location = useLocation();
  const active = getActiveTab(location.pathname, location.search);
  const s = useAppStrings(strings, stringsEn);

  const items: Array<{
    key: TabKey;
    label: string;
    icon: React.ReactNode;
    tapProps: React.HTMLAttributes<HTMLButtonElement>;
  }> = [
    {
      key: 'calls',
      label: s.dialerIconLabel,
      icon: <SymbolIcon name={IcSymbolPhone} size={26} />,
      tapProps: bindTap('tab.calls'),
    },
    {
      key: 'contacts',
      label: s.contactsAllLabel,
      icon: <SymbolIcon name={IcSymbolContactsCircle} size={26} />,
      tapProps: bindTap('tab.contacts'),
    },
    {
      key: 'favorites',
      label: s.personalFavoritesLabel,
      icon: <Star size={26} fill="currentColor" strokeWidth={1.7} />,
      tapProps: bindTap('tab.favorites'),
    },
  ];

  return (
    <div className="absolute left-0 right-0 bottom-0 z-40 bg-white/95 backdrop-blur border-t border-black/5">
      <div className="h-[72px] flex items-center justify-around px-6">
        {items.map((it) => {
          const isActive = active === it.key;
          const color = isActive ? 'text-[#18c765]' : 'text-gray-400';
          return (
            <button
              key={it.key}
              type="button"
              aria-label={it.label}
              {...it.tapProps}
              className="flex flex-col items-center justify-center gap-[2px] active:opacity-70 select-none"
            >
              <div className={color}>{it.icon}</div>
              <div className={['text-[11px] font-medium', color].join(' ')}>{it.label}</div>
            </button>
          );
        })}
      </div>
      {/* extra safe area to mimic gesture inset */}
      <div className="h-[14px]" />
    </div>
  );
};

