import React, { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import { TAOBAO_MESSAGE_CHANNELS, type TaobaoMessageThreadId } from '../constants';
import { useTaobaoGestures } from '../hooks/useTaobaoGestures';
import { useTaobaoStrings } from '../hooks/useTaobaoStrings';
import {
  IcClose,
  IcMessageAfterSale,
  IcMessageAssistant,
  IcMessageCoins,
  IcMessageContacts,
  IcMessageInteractive,
  IcMessageLogistics,
  IcMessageNotification,
  IcMessageOffers,
  IcMessagePromotion,
  IcMessageService,
  IcMessageSystem,
  IcMessageVip,
  IcPlus,
  IcSearch,
} from '../res/icons';
import { useTaobaoStore } from '../state';

interface TaobaoMessagesPageProps {
  tabBar: React.ReactNode;
}

interface MessageCopy {
  title: string;
  preview: string;
  time: string;
  icon: LucideIcon;
}

export function TaobaoMessagesPage({ tabBar }: TaobaoMessagesPageProps) {
  const s = useTaobaoStrings();
  const rawMessages = useTaobaoStore(state => state.messages);
  const markMessageRead = useTaobaoStore(state => state.markMessageRead);
  const markAllMessagesRead = useTaobaoStore(state => state.markAllMessagesRead);
  const dismissMessagePromo = useTaobaoStore(state => state.dismissMessagePromo);
  const enableMessageNotifications = useTaobaoStore(state => state.enableMessageNotifications);
  const dismissMessageNotificationPrompt = useTaobaoStore(state => state.dismissMessageNotificationPrompt);
  const setMessagesScrollTop = useTaobaoStore(state => state.setMessagesScrollTop);
  const { bindTap } = useTaobaoGestures();
  const listRef = React.useRef<HTMLElement>(null);
  const restoreScrollTop = React.useRef(rawMessages.scrollTop ?? 0);

  React.useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = restoreScrollTop.current;
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const copy = useMemo<Record<TaobaoMessageThreadId, MessageCopy>>(() => ({
    logistics: { title: s.messages_logistics, preview: s.messages_logistics_preview, time: '', icon: IcMessageLogistics },
    aftersale: { title: s.messages_aftersale, preview: s.messages_aftersale_preview, time: s.messages_time_recent, icon: IcMessageAfterSale },
    promotion: { title: s.messages_promotion, preview: s.messages_promotion_preview, time: '', icon: IcMessagePromotion },
    assistant: { title: s.messages_assistant, preview: s.messages_assistant_preview, time: s.messages_time_recent, icon: IcMessageAssistant },
    coins: { title: s.messages_coins, preview: s.messages_coins_preview, time: s.messages_time_now, icon: IcMessageCoins },
    offers: { title: s.messages_offers, preview: s.messages_offers_preview, time: s.messages_time_today, icon: IcMessageOffers },
    vip: { title: s.messages_vip, preview: s.messages_vip_preview, time: s.messages_time_today, icon: IcMessageVip },
    interactive: { title: s.messages_interactive, preview: s.messages_interactive_preview, time: s.messages_time_weekend, icon: IcMessageInteractive },
    service: { title: s.messages_service, preview: s.messages_service_preview, time: s.messages_time_weekend, icon: IcMessageService },
    system: { title: s.messages_system, preview: s.messages_system_preview, time: s.messages_time_recent, icon: IcMessageSystem },
  }), [s]);

  const channels = TAOBAO_MESSAGE_CHANNELS.filter(channel => !rawMessages.dismissedPromoIds.includes(channel.id));
  const unread = new Set(rawMessages.unreadThreadIds);
  const unreadCount = unread.size;
  const promptVisible = !rawMessages.notificationPromptDismissed && !rawMessages.notificationsEnabled;

  return <div className="tb-page tb-messages-page" data-status-bar-foreground="dark">
    <header className="tb-message-header">
      <div className="tb-message-title"><h1>{s.messages_title}</h1>{unreadCount > 0 && <b>({unreadCount})</b>}<button disabled={unreadCount === 0} {...(unreadCount > 0 ? bindTap<HTMLButtonElement>({ kind: 'action', id: 'taobao.messages.all.read' }, { onTrigger: markAllMessagesRead }) : {})}>{s.messages_clear_unread}</button></div>
      <div className="tb-message-tools" aria-label={s.messages_more}>
        <span aria-label={s.messages_search} aria-disabled="true"><IcSearch size={23}/></span>
        <span aria-label={s.messages_contacts} aria-disabled="true"><IcMessageContacts size={23}/></span>
        <span aria-label={s.messages_more} aria-disabled="true"><IcPlus size={25}/></span>
      </div>
    </header>
    <main ref={listRef} className="tb-message-list" data-scroll-container="main" data-scroll-direction="vertical" onScroll={event => setMessagesScrollTop(event.currentTarget.scrollTop)}>
      {channels.map(channel => {
        const item = copy[channel.id];
        const Icon = item.icon;
        const isUnread = unread.has(channel.id);
        return <article className={`tb-message-row tb-message-row-${channel.group}`} data-message-thread-id={channel.id} key={channel.id}>
          <button className="tb-message-row-main" {...bindTap<HTMLButtonElement>({ kind: 'action', id: 'taobao.messages.thread.read' }, { params: { threadId: channel.id }, onTrigger: () => markMessageRead(channel.id) })}>
            <span className={`tb-message-avatar tone-${channel.tone}`}><Icon size={26}/></span>
            <span className="tb-message-copy"><strong>{item.title}{channel.id === 'promotion' && <em>{s.messages_promotion_badge}</em>}</strong><small>{item.preview}</small></span>
            <span className="tb-message-meta"><time>{item.time}</time>{isUnread && <b aria-label="1 unread">1</b>}</span>
          </button>
          {'dismissible' in channel && channel.dismissible && <button className="tb-message-promo-close" aria-label={s.messages_promotion_dismiss} {...bindTap<HTMLButtonElement>({ kind: 'action', id: 'taobao.messages.promo.dismiss' }, { params: { threadId: channel.id }, onTrigger: () => dismissMessagePromo(channel.id) })}><IcClose size={17}/></button>}
        </article>;
      })}
    </main>
    {promptVisible && <aside className="tb-message-notification-prompt" aria-label={s.messages_notification_prompt}>
      <IcMessageNotification size={19}/><span>{s.messages_notification_prompt}</span>
      <button className="tb-message-notification-enable" {...bindTap<HTMLButtonElement>({ kind: 'action', id: 'taobao.messages.notifications.enable' }, { onTrigger: enableMessageNotifications })}>{s.messages_notification_enable}</button>
      <button className="tb-message-notification-close" aria-label={s.messages_notification_close} {...bindTap<HTMLButtonElement>({ kind: 'action', id: 'taobao.messages.notifications.dismiss' }, { onTrigger: dismissMessageNotificationPrompt })}><IcClose size={20}/></button>
    </aside>}
    {tabBar}
  </div>;
}
