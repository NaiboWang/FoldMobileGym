import React from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { IcSearch, IcAdd, IcClose, IcMore, IcNavForward } from '../res/icons';
import { ConversationItem } from './ConversationItem';
import { markConversationRead, markConversationUnread, deleteConversation, pinConversation, useSmsProviderState } from '../state';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useSmsGestures } from '../hooks/useSmsGestures';
import type { Conversation } from '../types';
import { selectedSmsConversationId } from '../workspaceSelection';
import { createSmsConversationHold } from '../conversationHold';
import { useSmsComposeOwner } from '../hooks/useSmsComposeOwner';
export const ConversationListPage: React.FC = () => {
    const { go, back } = useSmsGestures();
    const { conversations, messagesByConversationId } = useSmsProviderState();
    const s = useAppStrings(strings, stringsEn);
    const [query, setQuery] = React.useState('');
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();
    const selectedConversationId = selectedSmsConversationId(location.pathname, conversations);
    const menuConvId = searchParams.get('contextMenu');
    const menuConv = React.useMemo(
        () => (menuConvId ? conversations.find((c) => c.id === menuConvId) : null) ?? null,
        [menuConvId, conversations],
    );

    const hold = React.useMemo(() => createSmsConversationHold(), []);
    const ownsCompose = useSmsComposeOwner();
    const sources = React.useRef(conversations);
    sources.current = conversations;
    React.useEffect(() => () => hold.cancel(), [hold, location.key]);

    const openMenu = (conv: Conversation) => {
        setSearchParams((p) => { p.set('contextMenu', conv.id); return p; });
    };
    const closeMenu = () => {
        if (menuConvId) back();
    };
    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>, conv: Conversation) => {
        const row = event.currentTarget;
        hold.start(event, () => ownsCompose() && row.isConnected && row.checkVisibility()
            && sources.current.some(source => source === conv), () => openMenu(conv));
    };
    const handleConversationClick = (conversationId: string) => {
        if (hold.consumeClick()) return;
        go('conversation.open', { conversationId });
    };

    const handleNewMessage = () => {
        go('compose.open');
    };

    const handleSettings = () => {
        go('settings.open');
    };

    const filteredConversations = React.useMemo(() => {
        const q = query.trim();
        const filtered = conversations.filter((c) => {
            if (!q) return true;
            const hit =
                c.sender.includes(q) ||
                (messagesByConversationId[c.id] ?? []).some((m) => m.content.includes(q));
            return hit;
        });
        return filtered.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
    }, [conversations, query, messagesByConversationId]);

    return (
        <div className="sms-conversation-list" data-status-bar-foreground="dark">
            {/* Status bar spacer */}
            <div className="sms-conversation-status" />

            {/* Toolbar */}
            <div className="sms-conversation-toolbar">
                <button className="sms-conversation-menu" aria-label={s.settings_title} onClick={handleSettings}>
                    <IcMore size={22} />
                </button>
            </div>

            {/* Title */}
            <h1 className="sms-conversation-title">{s.app_name}</h1>

            {/* Search bar */}
            <div className="sms-conversation-search-wrap">
                <div className="sms-conversation-search">
                    <IcSearch size={16} className="text-gray-400 flex-shrink-0" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="flex-1 bg-transparent outline-none text-[14px] text-app-text placeholder:text-gray-400"
                        placeholder={s.search_hint}
                    />
                    {query.trim().length > 0 && (
                        <button
                            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100"
                            onClick={() => setQuery('')}
                            aria-label="清空搜索"
                        >
                            <IcClose size={16} className="text-gray-400" />
                        </button>
                    )}
                </div>
            </div>

            <div className="sms-conversation-categories" aria-hidden="true">
                <div className="sms-conversation-category"><span>{s.service_messages}</span><IcNavForward size={18} /></div>
                <div className="sms-conversation-category"><span>{s.notification_messages}</span><IcNavForward size={18} /></div>
            </div>

            {/* Conversation list */}
            <div className="sms-conversation-scroll" data-scroll-container="master" onScroll={() => hold.cancel()} data-scroll-direction="vertical">
                {filteredConversations.length === 0 ? (
                    <div className="py-12 text-center text-[13px] text-gray-400">{s.empty_search_results}</div>
                ) : (
                    filteredConversations.map((conversation) => {
                        const msgs = messagesByConversationId[conversation.id];
                        const lastMsg = msgs && msgs.length > 0 ? msgs[msgs.length - 1].content : '';
                        return (
                            <ConversationItem
                                key={conversation.id}
                                conversation={conversation}
                                preview={lastMsg}
                                onClick={() => handleConversationClick(conversation.id)}
                                onPointerDown={event => handlePointerDown(event, conversation)}
                                onPointerMove={event => hold.move(event)}
                                onPointerUp={event => hold.end(event.pointerId)}
                                onPointerCancel={event => hold.cancel(event.pointerId)}
                                onPointerLeave={event => hold.cancel(event.pointerId)}
                                selected={selectedConversationId === conversation.id}
                            />
                        );
                    })
                )}
            </div>

            {/* Context menu overlay */}
            {menuConv && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10" onClick={closeMenu}>
                    <div
                        className="bg-white rounded-2xl w-56 overflow-hidden shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {[
                            { label: s.menu_delete, action: () => { deleteConversation(menuConv.id); closeMenu(); } },
                            {
                                label: menuConv.isUnread ? s.menu_mark_read : s.menu_mark_unread,
                                action: () => {
                                    if (menuConv.isUnread) markConversationRead(menuConv.id);
                                    else markConversationUnread(menuConv.id);
                                    closeMenu();
                                },
                            },
                            {
                                label: menuConv.isPinned ? s.menu_unpin : s.menu_pin,
                                action: () => { pinConversation(menuConv.id, !menuConv.isPinned); closeMenu(); },
                            },
                            { label: s.menu_block, action: closeMenu },
                            { label: s.menu_add_contact, action: closeMenu },
                            { label: s.menu_encrypt, action: closeMenu },
                        ].map((item) => (
                            <button
                                key={item.label}
                                className="w-full px-5 py-3.5 text-left text-[15px] text-app-text active:bg-gray-50 border-b border-gray-100 last:border-b-0"
                                onClick={item.action}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* FAB - New message button */}
            <button
                className="sms-conversation-fab"
                type="button"
                aria-label={s.new_message_title}
                data-trigger="compose.open"
                onClick={handleNewMessage}
            >
                <IcAdd size={28} className="text-white" />
            </button>
        </div>
    );
};
