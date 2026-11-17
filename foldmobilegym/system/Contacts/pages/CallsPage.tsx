import React, { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Delete as DeleteIcon, Info, UserRound, Plus, Video, MessageCircle } from 'lucide-react';
import { useActivityId } from '../../../os/ActivityContext';
import { Toast } from '@/os/components/Toast';
import { useLocale } from '@/os/locale';
import { useAppStrings } from '@/os/useAppStrings';
import { useTheme } from '../../../os/ThemeContext';
import { SymbolIcon } from '../components/SymbolIcon';
import { CONTACTS_CONFIG } from '../data';
import { useContactsGestures } from '../hooks/useContactsGestures';
import { useSimProfiles } from '../hooks/useSimProfiles';
import { useContactsList } from '../state';
import { dialNumbersMatch } from '../utils/dialNumber';
import type { CallLogEntry, SimSlot } from '../phoneTypes';
import { IcSymbolExpandMore, IcSymbolPhone, IcSymbolSearch, IcSymbolSettings } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

const DialpadFab: React.FC<{
  label: string;
  tapProps: React.HTMLAttributes<HTMLButtonElement>;
}> = ({ label, tapProps }) => (
  <button
    type="button"
    {...tapProps}
    style={{
      ...(tapProps.style || {}),
      backgroundColor: 'var(--app-c-fab-background)',
    }}
    className={[
      'absolute right-6 bottom-[92px] w-14 h-14 rounded-full shadow-[0_10px_24px_rgba(0,0,0,0.16)]',
      'flex items-center justify-center active:scale-95 transition-transform',
      tapProps.className ?? '',
    ].join(' ')}
    aria-label={label}
  >
    <div className="grid grid-cols-3 gap-[3px]">
      {Array.from({ length: 9 }).map((_, index) => (
        <span key={index} className="w-[4px] h-[4px] rounded-full bg-app-surface" />
      ))}
    </div>
  </button>
);

const CallLogItem: React.FC<{
  entry: CallLogEntry;
  showDivider: boolean;
  tapProps?: React.HTMLAttributes<HTMLButtonElement>;
}> = ({ entry, showDivider, tapProps }) => {
  const s = useAppStrings(strings, stringsEn);

  return (
    <div className="bg-app-surface">
      <button
        type="button"
        {...(tapProps || {})}
        className={[
          'contacts-call-row w-full px-6 py-4 flex items-center justify-between active:bg-black/5 select-none text-left',
          tapProps?.className ?? '',
        ].join(' ')}
      >
        <span className="contacts-call-avatar" aria-hidden="true">
          {entry.displayName.trim()[0] && !/^\d/.test(entry.displayName.trim())
            ? entry.displayName.trim()[0]
            : <UserRound size={25} strokeWidth={1.7} />}
        </span>
        <div className="flex-1 min-w-0 contacts-call-copy">
          <div className="flex items-center gap-2 min-w-0">
            <div className="contacts-call-name text-[20px] font-semibold text-app-text truncate">{entry.displayName}</div>
            {entry.isOfficial ? (
              <span className="px-2 py-[2px] rounded-full bg-[#3B82F6] text-white text-[12px] font-semibold flex-shrink-0">
                {s.call_official_badge}
              </span>
            ) : null}
          </div>
          <div className="contacts-call-meta mt-1 text-[14px] text-gray-400 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-black/5 inline-block" aria-hidden="true" />
              {entry.dateText}
            </span>
            {entry.locationText ? <span>{entry.locationText}</span> : null}
          </div>
        </div>
        <Info className="contacts-call-info w-5 h-5 text-gray-500 ml-3 flex-shrink-0" strokeWidth={1.8} />
      </button>
      {showDivider ? <div className="h-px bg-black/5 ml-6" /> : null}
    </div>
  );
};

export const DialpadOverlay: React.FC<{
  digits: string;
  getDigits: () => string;
  setDigits: React.Dispatch<React.SetStateAction<string>>;
  isUnfolded: boolean;
}> = ({ digits, getDigits, setDigits, isUnfolded }) => {
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const { themeService, version } = useTheme();
  const s = useAppStrings(strings, stringsEn);
  const { bindBack, bindTap, go } = useContactsGestures();
  const activityId = useActivityId();
  const callClaimed = useRef(false);
  const sims = useSimProfiles();
  const numberMeta = useMemo(() => {
    return CONTACTS_CONFIG.callLogs.find(entry => dialNumbersMatch(entry.number, digits))?.locationText ?? '';
  }, [digits]);
  const panelRef = useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { queueMicrotask(() => { if (previous?.isConnected && !previous.closest('[inert]')) previous.focus(); }); };
  }, []);
  React.useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      window.__OS__?.handleBack();
    };
    window.addEventListener('keydown', onEscape, true);
    return () => window.removeEventListener('keydown', onEscape, true);
  }, []);

  const buttons = [
    { key: '1', sub: '' },
    { key: '2', sub: 'ABC' },
    { key: '3', sub: 'DEF' },
    { key: '4', sub: 'GHI' },
    { key: '5', sub: 'JKL' },
    { key: '6', sub: 'MNO' },
    { key: '7', sub: 'PQRS' },
    { key: '8', sub: 'TUV' },
    { key: '9', sub: 'WXYZ' },
    { key: '*', sub: '' },
    { key: '0', sub: '+' },
    { key: '#', sub: '' },
  ] as const;

  const call = (slot: SimSlot) => {
    if (!digits) {
      window.dispatchEvent(new CustomEvent('phone:toast', {
        detail: { message: isEnglish ? 'Please enter a number' : '请输入号码' },
      }));
      return;
    }
    const os = window.__OS__?.getState();
    const top = os?.tasks.find(task => task.taskId === os.activeTaskId)?.stack.at(-1);
    const route = window.__OS__?.getAppRoute('contacts')?.path ?? '';
    const [pathname, query = ''] = route.split('?');
    if (callClaimed.current || getDigits() !== digits || os?.isLauncherVisible || os?.isRecentsVisible
      || top?.activityId !== activityId || pathname !== '/' || new URLSearchParams(query).get('dialpad') !== 'true') return;
    callClaimed.current = true;
    go('dialpad.simulatedCall.open', { number: digits, slot });
  };

  const backspace = () => {
    setDigits((previous) => previous.slice(0, Math.max(0, previous.length - 1)));
  };

  return (
    <div className="contacts-dialpad-owner absolute inset-0 z-30" data-posture={isUnfolded ? 'unfolded' : 'folded'}>
      <button type="button" className="contacts-dialpad-backdrop absolute inset-0 bg-black/0" aria-label={s.close_dialpad} {...bindBack()} />

      <div ref={panelRef} role="dialog" aria-modal={isUnfolded ? undefined : true} aria-label={s.dialpad_title}
        data-scroll-container="dialpad" data-scroll-direction="vertical"
        className="contacts-dialpad-panel absolute left-0 right-0 bottom-[86px] bg-app-surface rounded-t-[24px] shadow-[0_-12px_28px_rgba(0,0,0,0.10)]"
        onKeyDown={event => {
          if (!isUnfolded && event.key === 'Tab') {
            const controls = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
            const index = controls.indexOf(document.activeElement as HTMLButtonElement);
            event.preventDefault(); controls[(index + (event.shiftKey ? controls.length - 1 : 1)) % controls.length]?.focus();
          }
        }}>
        <div className="contacts-dialpad-display px-6 pt-5 pb-2">
          <div className="relative flex items-center justify-center min-h-[44px]">
            <output data-benchmark-field="dialpad-digits" aria-label={s.dialpad_number} className="contacts-dialpad-number text-center text-[28px] font-semibold tracking-wider text-app-text min-h-[36px] px-10">
              {digits || '\u00A0'}
            </output>
            <button
              type="button"
              aria-label={isEnglish ? 'Delete' : '删除'}
              className="contacts-dialpad-delete-folded absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5"
              {...bindTap({ kind: 'action', id: 'contacts.dialpad.digit.remove' }, { onTrigger: backspace })}
            >
              <DeleteIcon size={20} strokeWidth={1.8} className="text-gray-500" />
            </button>
          </div>
          <div className="contacts-dialpad-subtitle min-h-5 mt-1 text-center text-[13px] text-gray-400">
            {numberMeta || (isUnfolded && digits ? s.dialpad_pinyin_search : '')}
          </div>
        </div>

        <div className="contacts-dialpad-keys px-8 pb-4">
          <div className="grid grid-cols-3 gap-y-4 gap-x-8">
            {buttons.map((button) => (
              <button
                key={button.key}
                type="button"
                className="h-(--app-dialpad-key-height) rounded-full active:bg-black/5 flex flex-col items-center justify-center"
                {...bindTap({ kind: 'action', id: 'contacts.dialpad.digit.append' }, {
                  params: { digit: button.key }, onTrigger: () => setDigits(previous => previous + button.key),
                })}
              >
                {(() => {
                  const hint = `dialpad_${button.key}`;
                  const uri =
                    themeService.getAppAsset('contact', hint) ||
                    themeService.getAppAsset('contact', `key_${button.key}`) ||
                    themeService.getAppAsset('contact', button.key) ||
                    null;

                  if (!uri) {
                    return <div className="text-[28px] text-app-text font-medium leading-none">{button.key}</div>;
                  }

                  return <img key={`${version}_${button.key}`} src={uri} className="h-[28px] object-contain" alt={button.key} />;
                })()}
                <div className="text-[10px] text-gray-400 font-semibold leading-none mt-1">{button.sub}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="contacts-dialpad-actions px-5 pb-5 flex items-center justify-between gap-3">
          <button
            type="button"
            aria-label={isEnglish ? 'Menu' : '菜单'}
            className="contacts-dialpad-menu w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5 text-gray-700"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent('phone:toast', {
                  detail: { message: isEnglish ? 'Dialer menu is not implemented yet' : '拨号菜单（未实现）' },
                }),
              )
            }
          >
            <div className="flex flex-col gap-[3px]">
              <span className="w-5 h-[2px] rounded-full bg-current" />
              <span className="w-5 h-[2px] rounded-full bg-current" />
              <span className="w-5 h-[2px] rounded-full bg-current" />
            </div>
          </button>

          <button
            type="button"
            style={{
              backgroundColor: 'var(--app-c-call-button-background)',
              ...(themeService.getAppAsset('contact', 'call_button')
                ? {
                    backgroundImage: `url(${themeService.getAppAsset('contact', 'call_button')})`,
                    backgroundSize: '100% 100%',
                  }
                : {}),
            }}
            className="contacts-dialpad-call-primary flex-1 h-12 rounded-full text-white text-[16px] font-semibold active:opacity-80 bg-center bg-no-repeat"
            {...bindTap('dialpad.simulatedCall.open', { params: { number: digits, slot: sims[0]?.slot ?? 1 }, onTrigger: () => call((sims[0]?.slot ?? 1) as SimSlot) })}
          >
            <span className="inline-flex items-center justify-center gap-2">
              <SymbolIcon name={IcSymbolPhone} size={18} className="text-white" />
              {sims[0]?.label ?? s.sim_card_1}
            </span>
          </button>

          <button
            type="button"
            style={{
              backgroundColor: 'var(--app-c-call-button-background)',
              ...(themeService.getAppAsset('contact', 'call_button')
                ? {
                    backgroundImage: `url(${themeService.getAppAsset('contact', 'call_button')})`,
                    backgroundSize: '100% 100%',
                  }
                : {}),
            }}
            className="contacts-dialpad-call-secondary flex-1 h-12 rounded-full text-white text-[16px] font-semibold active:opacity-80 bg-center bg-no-repeat"
            {...bindTap('dialpad.simulatedCall.open', { params: { number: digits, slot: sims[1]?.slot ?? 2 }, onTrigger: () => call((sims[1]?.slot ?? 2) as SimSlot) })}
          >
            <span className="inline-flex items-center justify-center gap-2">
              <SymbolIcon name={IcSymbolPhone} size={18} className="text-white" />
              {sims[1]?.label ?? s.sim_card_2}
            </span>
          </button>

          <button
            type="button"
            aria-label={isEnglish ? 'More' : '更多'}
            className="contacts-dialpad-more w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent('phone:toast', {
                  detail: { message: isEnglish ? 'More actions are not implemented yet' : '更多（未实现）' },
                }),
              )
            }
          >
            <div className="grid grid-cols-3 gap-[3px] text-gray-700">
              {Array.from({ length: 9 }).map((_, index) => (
                <span key={index} className="w-[3px] h-[3px] rounded-full bg-current" />
              ))}
            </div>
          </button>
          <button
            type="button"
            aria-label={isEnglish ? 'Delete' : '删除'}
            className="contacts-dialpad-delete-wide hidden w-12 h-12 rounded-full items-center justify-center active:bg-black/5"
            {...bindTap({ kind: 'action', id: 'contacts.dialpad.digit.remove' }, { onTrigger: backspace })}
          >
            <DeleteIcon size={22} strokeWidth={1.8} className="text-gray-500" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const CallsPage: React.FC<{
  detailTapProps?: (callLogId: string) => React.HTMLAttributes<HTMLButtonElement>;
  directory?: boolean;
  dialpadDigits?: string;
  getDialpadDigits?: () => string;
}> = ({ detailTapProps, directory = false, dialpadDigits = '', getDialpadDigits }) => {
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const { bindTap, go } = useContactsGestures();
  const activityId = useActivityId();
  const latestDigits = useRef(dialpadDigits);
  latestDigits.current = dialpadDigits;
  const ownsDialpad = () => {
    const os = window.__OS__?.getState();
    const top = os?.tasks.find(task => task.taskId === os.activeTaskId)?.stack.at(-1);
    const route = window.__OS__?.getAppRoute('contacts')?.path ?? '';
    const [path, query = ''] = route.split('?');
    return !!dialpadDigits && latestDigits.current === dialpadDigits && (getDialpadDigits?.() ?? dialpadDigits) === dialpadDigits && !os?.isLauncherVisible
      && !os?.isRecentsVisible && top?.activityId === activityId
      && path === '/' && new URLSearchParams(query).get('dialpad') === 'true';
  };
  const [searchParams] = useSearchParams();
  const dialpadOpen = searchParams.get('dialpad') === 'true';
  const seededNumber = dialpadDigits;
  const list = useMemo(() => CONTACTS_CONFIG.callLogs, []);
  const contacts = useContactsList();
  const s = useAppStrings(strings, stringsEn);
  const dialpadContext = useMemo(() => {
    if (!seededNumber) return null;
    const contact = contacts.find(item => item.phones.some(phone => dialNumbersMatch(phone.number, seededNumber)));
    if (contact) return { name: contact.displayName, number: seededNumber };
    const call = list.find(item => dialNumbersMatch(item.number, seededNumber));
    return call ? { name: call.displayName, number: seededNumber } : null;
  }, [contacts, list, seededNumber]);

  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const toastTimerRef = useRef<number | null>(null);

  const showToast = (message: string) => {
    setToast({ visible: true, message });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast({ visible: false, message: '' }), 1300);
  };

  React.useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: string }>;
      const message = customEvent.detail?.message;
      if (typeof message === 'string' && message) {
        showToast(message);
      }
    };

    window.addEventListener('phone:toast', handler);
    return () => {
      window.removeEventListener('phone:toast', handler);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  return (
    <div className="h-full w-full bg-app-surface relative flex flex-col">
      <Toast visible={toast.visible} message={toast.message} />
      <div className="contacts-calls-directory" style={{ display: 'contents' }}>

      <div className="sticky top-0 z-20 bg-app-surface">
        <div className="h-10" />
        <div className="px-6 pt-2 pb-3 relative">
          <div className="text-[36px] font-semibold text-app-text">{s.dialerIconLabel}</div>

          <button
            type="button"
            aria-label={isEnglish ? 'Settings' : '设置'}
            {...bindTap('settings.open.calls')}
            className="absolute right-5 top-2 w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5"
          >
            <SymbolIcon name={IcSymbolSettings} size={24} className="text-gray-700" />
          </button>
        </div>

        <div className="px-6 pb-2">
          <button
            type="button"
            {...bindTap('search.open')}
            className="w-full h-11 rounded-full bg-black/5 flex items-center px-4 text-[16px] text-gray-400 active:bg-black/10 text-left"
          >
            <SymbolIcon name={IcSymbolSearch} size={18} className="text-gray-400 mr-2" />
            {s.searchHint}
          </button>
        </div>

        <div className="px-6 pb-2">
          <button type="button" className="text-[16px] font-semibold text-[#9CA3AF] flex items-center gap-1 active:opacity-70">
            {s.callFilterAll}
            <SymbolIcon name={IcSymbolExpandMore} size={18} className="text-[#9CA3AF]" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-[110px]" data-scroll-container={directory ? 'directory' : 'main'} data-scroll-direction="vertical">
        {list.map((entry, index) => {
          const tapProps = detailTapProps?.(entry.id)
            ?? bindTap('call.open', { params: { callLogId: entry.id } });
          return (
            <CallLogItem
              key={entry.id}
              entry={entry}
              showDivider={index < list.length - 1}
              tapProps={tapProps}
            />
          );
        })}
      </div>

      {!dialpadOpen ? <DialpadFab label={isEnglish ? 'Open dial pad' : '打开拨号盘'} tapProps={bindTap('dialpad.open')} /> : null}
      </div>
      {dialpadOpen && dialpadDigits && !dialpadContext ? (
        <div className="contacts-dialpad-context contacts-dialpad-unknown hidden h-full bg-app-surface">
          <button type="button" {...bindTap('dialpad.contact.new', { params: { number: dialpadDigits }, onTrigger: () => {
            if (ownsDialpad()) go('dialpad.contact.new', { number: dialpadDigits });
          } })}><Plus size={23} /><span>{s.dialpad_create_contact}</span></button>
          <button type="button" {...bindTap('dialpad.contact.existing', { params: { number: dialpadDigits }, onTrigger: () => {
            if (ownsDialpad()) go('dialpad.contact.existing', { number: dialpadDigits });
          } })}><UserRound size={23} /><span>{s.dialpad_add_existing}</span></button>
          <button type="button" disabled title={s.dialpad_action_unavailable}><Video size={23} /><span>{s.dialpad_video_call}</span></button>
          <button type="button" {...bindTap({ kind: 'action', id: 'contacts.dialpad.sms.open' }, { params: { number: dialpadDigits }, onTrigger: () => {
            if (ownsDialpad()) window.__OS__?.startActivity({ action: 'ACTION_VIEW', scheme: 'sms', data: { address: dialpadDigits } });
          } })}><MessageCircle size={23} /><span>{s.dialpad_send_message}</span></button>
        </div>
      ) : null}
      {dialpadOpen && dialpadContext ? (
        <div className="contacts-dialpad-context hidden h-full px-8 pt-[112px] bg-app-surface">
          <div className="flex items-start justify-between gap-5">
            <div className="min-w-0">
              <div className="text-[22px] font-medium text-app-text truncate">{dialpadContext.name}</div>
              {dialpadContext.number ? <div className="mt-1 text-[15px] text-[#24b766]">{dialpadContext.number}</div> : null}
            </div>
            <Info className="w-7 h-7 text-gray-600 flex-none" strokeWidth={1.7} aria-hidden="true" />
          </div>
        </div>
      ) : null}
    </div>
  );
};
