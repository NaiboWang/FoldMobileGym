import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { IcNavBack, IcExpand, IcMore, IcPhone, IcAdd, IcSmile, IcUser } from '../res/icons';
import { AttachmentPanel } from './AttachmentPanel';
import { Toast } from '@/os/components/Toast';
import { markConversationRead, sendMessage, useSmsProviderState, useSmsStore } from '../state';
import { smsConversationSourceKey } from '../conversationDrafts';
import { useTheme } from '../../../os/ThemeContext';
import { NinePatch } from '../../../os/ui/ninepatch/NinePatch';
import { SendArrowIcon } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useSmsGestures } from '../hooks/useSmsGestures';
import { useSmsComposeOwner } from '../hooks/useSmsComposeOwner';
import { smsComposeRows } from '../composeText';
import { smsMessageStatusKey } from '../messageStatus';
import ContentResolver from '@/os/ContentResolver';
import type { Conversation } from '../types';

const Bubble: React.FC<{
    messageId: string;
    outgoing: boolean;
    content: string;
    timestamp: string;
    status?: string;
}> = ({ messageId, outgoing, content, timestamp, status }) => {
    const { themeService, version } = useTheme();
    const s = useAppStrings(strings, stringsEn);
    const statusKey = smsMessageStatusKey(status);
    const bubbleCls = outgoing
        ? 'bg-app-primary text-white rounded-2xl rounded-tr-md'
        : 'bg-app-surface text-app-text rounded-2xl rounded-tl-md border border-gray-100';

    const themedBg = useMemo(() => {
        const pick = (hints: string[]) => hints.map((h) => themeService.getAppAsset('mms', h)).find(Boolean) || null;
        return outgoing
            ? pick(['bubble_out', 'bubble_send', 'msg_out', 'message_out', 'chat_to', 'sms_out'])
            : pick(['bubble_in', 'bubble_recv', 'msg_in', 'message_in', 'chat_from', 'sms_in']);
    }, [outgoing, themeService, version]);

    return (
        <div data-sms-message-id={messageId} className={`sms-message-group flex flex-col ${outgoing ? 'items-end' : 'items-start'}`}>
            {themedBg ? (
                <NinePatch
                    src={themedBg}
                    className={`max-w-[78%] text-[15px] leading-relaxed ${bubbleCls.replace(outgoing ? 'bg-app-primary' : 'bg-app-surface', 'bg-transparent')}`}
                >
                    <div className="px-4 py-2.5 whitespace-pre-wrap [overflow-wrap:anywhere]">{content}</div>
                </NinePatch>
            ) : (
                <div className={`max-w-[78%] px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere] ${bubbleCls}`}>{content}</div>
            )}
            <div className="mt-1 text-[11px] text-gray-400 flex items-center gap-2">
                <span>{timestamp}</span>
                {outgoing && statusKey && <span data-sms-message-status={status}>{s[statusKey]}</span>}
            </div>
        </div>
    );
};

export const ConversationDetailPage: React.FC = () => {
    const ownsCompose = useSmsComposeOwner(), composing = useRef(false);
    const { bindBack, bindTap, back } = useSmsGestures();
    const { conversationId } = useParams<{ conversationId: string }>();
    const { conversations, messagesByConversationId } = useSmsProviderState();
    const conversation = useMemo(
        () => conversationId ? conversations.find(c => c.id === conversationId) : undefined,
        [conversations, conversationId],
    );
    const messages = useMemo(
        () => conversationId ? (messagesByConversationId[conversationId] ?? []) : [],
        [messagesByConversationId, conversationId],
    );
    const s = useAppStrings(strings, stringsEn);

    const draft = useSmsStore(state => conversationId ? state.conversationDrafts?.[conversationId] : undefined);
    const updateDraft = useSmsStore(state => state.updateConversationDraft);
    const text = draft?.body ?? '';
    const [searchParams] = useSearchParams();
    const showAttachments = searchParams.get('panel') === 'attachments';
    const sameRecipient = Boolean(conversation && (!draft || draft.sourceKey === smsConversationSourceKey(conversation)));
    const isCurrent = () => {
        if (!ownsCompose() || !sameRecipient || !conversation) return false;
        const current = ContentResolver.query<Conversation>(`content://sms/conversations/${conversation.id}`).items[0];
        return !!current && smsConversationSourceKey(current) === smsConversationSourceKey(conversation);
    };
    const setText = (value: string) => { if (conversation && isCurrent()) updateDraft(conversation, value); };
    const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });

    const listRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!conversationId) return;
        markConversationRead(conversationId);
    }, [conversationId, markConversationRead]);

    useEffect(() => {
        // Scroll to bottom on first open & when new message arrives
        const el = listRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [messages.length]);

    const showToast = (message: string) => {
        setToast({ visible: true, message });
        window.setTimeout(() => setToast({ visible: false, message: '' }), 1200);
    };

    const canSend = text.trim().length > 0 && !!conversationId && !!conversation && sameRecipient;
    const handleSend = () => {
        if (composing.current || !conversationId || !conversation || !isCurrent()) return;
        const currentDraft = useSmsStore.getState().conversationDrafts?.[conversationId];
        const content = currentDraft?.body.trim() ?? '';
        if (!content || currentDraft?.sourceKey !== smsConversationSourceKey(conversation)) return;
        setText('');
        if (showAttachments) back();
        sendMessage(conversationId, content);
    };

    if (!conversationId || !conversation) {
        return (
            <div className="h-full bg-app-surface flex flex-col">
                <div className="h-12 flex-shrink-0" />
                <div className="flex items-center px-4 h-12">
                    <button className="w-10 h-10 -ml-2 flex items-center justify-center" {...bindBack()}>
                        <IcNavBack size={24} className="text-app-text" />
                    </button>
                </div>
                <div className="px-6 pt-2 pb-4">
                    <h1 className="text-[18px] font-medium text-app-text">{s.conversation_not_found}</h1>
                </div>
            </div>
        );
    }

    return (
        <div className="sms-detail-page h-full bg-app-bg flex flex-col">
            <Toast message={toast.message} visible={toast.visible} />

            {/* Status bar spacer */}
            <div className="h-12 flex-shrink-0" />

            {/* Header */}
            <div className="sms-detail-header flex items-center px-4 h-12 flex-shrink-0">
                <button className="sms-pane-back w-10 h-10 -ml-2 flex items-center justify-center" {...bindBack()}>
                    <IcNavBack size={24} className="text-app-text" />
                </button>
                <span className="sms-detail-avatar" aria-hidden="true"><IcUser size={21} /></span>
                <div className="sms-detail-header-copy flex-1 min-w-0 text-center">
                    <div className="text-[16px] font-medium text-app-text truncate">{conversation?.sender ?? s.app_name}</div>
                    <div data-sms-recipient-number className="text-[12px] text-app-text-muted break-all">{conversation.phoneNumber ?? s.conversation_number_unavailable}</div>
                </div>
                <div className="sms-detail-actions" aria-hidden="true">
                    <span className="sms-detail-action"><IcPhone size={20} /></span>
                    <span className="sms-detail-action"><IcMore size={20} /></span>
                </div>
            </div>

            {/* Messages */}
            <div ref={listRef} className="sms-detail-messages flex-1 overflow-y-auto no-scrollbar px-4 py-3 flex flex-col gap-3" data-scroll-container="main" data-scroll-direction="vertical">
                {messages.length === 0 ? (
                    <div className="text-center text-[13px] text-gray-400 mt-10">{s.empty_messages}</div>
                ) : (
                    messages.map((m) => (
                        <Bubble
                            key={m.id}
                            messageId={m.id}
                            outgoing={m.isOutgoing}
                            content={m.content}
                            timestamp={m.timestamp}
                            status={m.status}
                        />
                    ))
                )}
                <div className="h-2" />
            </div>

            {/* Bottom input area */}
            <div className="sms-detail-composer flex-shrink-0 border-t border-gray-100 bg-app-bg" data-keep-keyboard="true">
                {!sameRecipient && <p role="alert" className="px-4 py-2 text-sm text-app-text-muted">{s.conversation_recipient_changed}</p>}
                {showAttachments && <AttachmentPanel />}

                <div className="flex items-center px-3 py-2 gap-2">
                    <button
                        className="sms-composer-attachment w-11 h-11 shrink-0 flex items-center justify-center bg-app-surface rounded-full"
                        {...(showAttachments ? bindBack() : bindTap('conversation.attachments.open', { params: { conversationId } }))}
                    >
                        {showAttachments ? (
                            <IcExpand size={20} className="text-gray-600" />
                        ) : (
                            <IcAdd size={23} />
                        )}
                    </button>

                    <div className="flex-1 min-w-0 bg-app-surface rounded-full flex items-center px-4 py-2.5">
                        <textarea
                            rows={smsComposeRows(text)}
                            data-benchmark-field="sms-conversation-body"
                            data-action="sms.conversation.body.input"
                            data-action-type="input"
                            data-action-params={JSON.stringify({ conversationId, value: text })}
                            readOnly={!sameRecipient}
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            onCompositionStart={() => { composing.current = true; }}
                            onCompositionEnd={e => { composing.current = false; setText(e.currentTarget.value); }}
                            onBlur={() => { composing.current = false; }}
                            className="flex-1 min-w-0 resize-none text-[14px] text-app-text outline-none"
                            placeholder={s.sms_placeholder}
                        />
                    </div>

                    <span className="text-app-text-muted" aria-hidden="true"><IcSmile size={22} /></span>

                    <button
                        className={`w-11 h-11 shrink-0 flex items-center justify-center rounded-full ${canSend ? 'bg-app-primary' : 'bg-gray-200'
                            }`}
                        onPointerDown={(e) => e.preventDefault()}
                        aria-label={s.action_send}
                        {...(showAttachments
                            ? bindTap({ kind: 'action', id: 'sms.conversation.attachments.send.submit' }, { params: { conversationId }, onTrigger: handleSend })
                            : bindTap({ kind: 'action', id: 'sms.conversation.send.submit' }, { params: { conversationId }, onTrigger: handleSend }))}
                        aria-disabled={!canSend}
                    >
                        <SendArrowIcon active={canSend} />
                    </button>
                </div>
            </div>
        </div>
    );
};
