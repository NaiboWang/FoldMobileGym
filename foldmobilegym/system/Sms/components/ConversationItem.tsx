import React from 'react';
import type { Conversation } from '../types';

interface ConversationItemProps {
    conversation: Conversation;
    /** Derived from latest message — not stored on Conversation */
    preview: string;
    onClick?: () => void;
    onPointerDown?: React.PointerEventHandler<HTMLDivElement>;
    onPointerMove?: React.PointerEventHandler<HTMLDivElement>;
    onPointerUp?: React.PointerEventHandler<HTMLDivElement>;
    onPointerCancel?: React.PointerEventHandler<HTMLDivElement>;
    onPointerLeave?: React.PointerEventHandler<HTMLDivElement>;
    selected?: boolean;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
    conversation,
    preview,
    onClick,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onPointerLeave,
    selected = false,
}) => {
    const {
        sender,
        timestamp,
        avatarUrl,
        avatarColor,
        avatarText,
        isUnread,
        simSlot,
    } = conversation;

    return (
        <div
            className="sms-conversation-item"
            data-conversation-id={conversation.id}
            data-selected={selected || undefined}
            data-trigger="conversation.open"
            data-trigger-type="tap"
            data-trigger-params={JSON.stringify({ conversationId: conversation.id })}
            onClick={onClick}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onPointerLeave={onPointerLeave}
        >
            {/* Unread indicator */}
            <div className="sms-conversation-unread">
                {isUnread && (
                    <span />
                )}
            </div>

            {/* Avatar */}
            <div className="sms-conversation-avatar">
                <div
                    className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden"
                    style={{ backgroundColor: avatarColor || '#E0E0E0' }}
                >
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-white text-sm font-medium">
                            {avatarText || sender.charAt(0)}
                        </span>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="sms-conversation-copy">
                {/* Header row: sender + SIM badge + timestamp */}
                <div className="sms-conversation-heading">
                    <span className="sms-conversation-sender">
                        {sender}
                    </span>
                    {simSlot && (
                        <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                            {simSlot}
                        </span>
                    )}
                    <span className="sms-conversation-time">
                        {timestamp}
                    </span>
                </div>

                {/* Preview text */}
                <p className="sms-conversation-preview">
                    {preview}
                </p>
            </div>
        </div>
    );
};
