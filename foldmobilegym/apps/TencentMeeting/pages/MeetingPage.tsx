import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import * as TimeService from '../../../os/TimeService';
import { useMeetingGestures } from '../hooks/useMeetingGestures';
import { useTencentMeetingStrings } from '../hooks/useTencentMeetingStrings';
import {
    IcAdd,
    IcAudio,
    IcBadge,
    IcBot,
    IcCalendarDays,
    IcCaptions,
    IcCheck,
    IcClose,
    IcDisc,
    IcEdit2,
    IcExpand,
    IcExternalLink,
    IcFile,
    IcHand,
    IcImage,
    IcLayout,
    IcMenu,
    IcMessage,
    IcMic,
    IcMicOff,
    IcMonitor,
    IcParticipants,
    IcScreenShare,
    IcSearch,
    IcSettings,
    IcShare,
    IcSmile,
    IcStopCircle,
    IcSubtitles,
    IcUserAdd,
    IcUserCog,
    IcVideo,
    IcVideoOff,
    IcVolume,
} from '../res/icons';
import { useMeetingStore } from '../state';
import type { ActiveParticipant } from '../types';
import { getPersistedMeetingChatRecipientName, shouldShowPrivateChatBadge } from '../utils/meetingDataValue';
import './meeting-active.css';

type Recipient = { id: string; name: string } | 'all';

const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const ParticipantAvatar = ({ participant, compact = false }: { participant: ActiveParticipant; compact?: boolean }) => (
    <div className={`tm-avatar ${compact ? 'tm-avatar--compact' : ''}`}>
        {participant.avatar ? (
            <img src={participant.avatar} alt="" />
        ) : (
            <span>{participant.name.slice(0, 2)}</span>
        )}
        {participant.isHost && (
            <span className="tm-avatar-role">
                <IcParticipants size={compact ? 9 : 11} />
            </span>
        )}
    </div>
);

export const MeetingPage: React.FC = () => {
    const location = useLocation();
    const { bindTap, bindBack, back } = useMeetingGestures();
    const { user, activeMeeting, pendingMeetingConfig } = useMeetingStore(useShallow(state => ({
        user: state.user,
        activeMeeting: state.activeMeeting,
        pendingMeetingConfig: state.pendingMeetingConfig,
    })));
    const setPendingMeetingConfig = useMeetingStore(state => state.setPendingMeetingConfig);
    const startMeeting = useMeetingStore(state => state.startMeeting);
    const endMeeting = useMeetingStore(state => state.endMeeting);
    const updateMeetingSettings = useMeetingStore(state => state.updateMeetingSettings);
    const updateParticipant = useMeetingStore(state => state.updateParticipant);
    const muteAllParticipants = useMeetingStore(state => state.muteAllParticipants);
    const sendChatMessage = useMeetingStore(state => state.sendChatMessage);
    const s = useTencentMeetingStrings();

    const [duration, setDuration] = useState('00:00');
    const [isEntering, setIsEntering] = useState(true);
    const [recipient, setRecipient] = useState<Recipient>('all');
    const [chatMessage, setChatMessage] = useState('');
    const [renameText, setRenameText] = useState('');
    const hasInitializedMeetingRef = useRef(false);
    const chatTextareaRef = useRef<HTMLTextAreaElement | null>(null);
    const chatScrollRef = useRef<HTMLDivElement | null>(null);

    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const dialog = searchParams.get('dialog');
    const selectedMemberId = searchParams.get('member');
    const selectedMember = activeMeeting?.participants.find(participant => participant.id === selectedMemberId);
    const activeMeetingJoinTime = activeMeeting?.joinTime;

    useEffect(() => {
        if (hasInitializedMeetingRef.current) return;
        hasInitializedMeetingRef.current = true;
        if (!activeMeeting) {
            const usePersonalId = pendingMeetingConfig?.usePersonalId ?? false;
            const cameraOn = pendingMeetingConfig?.videoOn;
            startMeeting({ isHost: true, usePersonalId, settings: { cameraOn } });
            setPendingMeetingConfig(null);
        }
    }, [activeMeeting, pendingMeetingConfig, setPendingMeetingConfig, startMeeting]);

    useEffect(() => {
        const timer = window.setTimeout(() => setIsEntering(false), 2000);
        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (activeMeetingJoinTime === undefined || isEntering) return;
        const updateDuration = () => {
            const elapsed = TimeService.now() - activeMeetingJoinTime - 2000;
            setDuration(formatDuration(Math.max(0, elapsed)));
        };
        updateDuration();
        const interval = window.setInterval(updateDuration, 1000);
        return () => window.clearInterval(interval);
    }, [activeMeetingJoinTime, isEntering]);

    const messages = activeMeeting?.chatMessages ?? [];
    const isMuted = activeMeeting?.settings.isMuted ?? true;
    const isVideoOn = activeMeeting?.settings.isVideoOn ?? false;
    const isSharing = activeMeeting?.settings.isSharing ?? false;
    const isRecording = activeMeeting?.settings.isRecording ?? false;
    const isHost = activeMeeting?.hostId === user.id;
    const participantCount = activeMeeting?.participants.length ?? 1;
    const deviceCount = Math.max(2, participantCount);
    const primaryParticipant = activeMeeting?.participants.find(participant => participant.id === user.id)
        ?? activeMeeting?.participants[0];

    const scrollChatToBottom = React.useCallback(() => {
        const element = chatScrollRef.current;
        if (!element) return;
        element.scrollTop = element.scrollHeight;
    }, []);

    useEffect(() => {
        const element = chatTextareaRef.current;
        if (!element) return;
        element.style.height = 'auto';
        const height = Math.min(element.scrollHeight, 72);
        element.style.height = `${height}px`;
        element.style.overflowY = element.scrollHeight > 72 ? 'auto' : 'hidden';
        scrollChatToBottom();
    }, [chatMessage, scrollChatToBottom]);

    useEffect(() => {
        if (dialog !== 'chat') return;
        const firstFrame = requestAnimationFrame(() => {
            requestAnimationFrame(scrollChatToBottom);
        });
        const onResize = () => window.setTimeout(scrollChatToBottom, 80);
        window.addEventListener('resize', onResize);
        return () => {
            cancelAnimationFrame(firstFrame);
            window.removeEventListener('resize', onResize);
        };
    }, [dialog, messages.length, scrollChatToBottom]);

    const handleSendMessage = () => {
        const text = chatMessage.trimEnd();
        if (!text) return;
        const toId = recipient === 'all' ? 'all' : recipient.id;
        sendChatMessage(text, toId, getPersistedMeetingChatRecipientName(recipient));
        setChatMessage('');
    };

    const handleRenameSubmit = () => {
        if (!selectedMemberId || !renameText.trim()) return;
        updateParticipant(selectedMemberId, { name: renameText.trim() });
        back();
    };

    const moreTools = [
        { key: 'invite', icon: IcUserAdd, label: s.meeting_invite },
        { key: 'host-tools', icon: IcUserCog, label: s.meeting_host_tools },
        { key: 'chat', icon: IcMessage, label: s.meeting_chat_title, binding: bindTap('meeting.more.chat.open') },
        {
            key: 'recording',
            icon: IcDisc,
            label: isRecording ? s.meeting_stop_record : s.meeting_cloud_record,
            active: isRecording,
            binding: bindTap(
                { kind: 'action', id: 'meeting.recording.toggle' },
                { params: { to: !isRecording }, onTrigger: () => updateMeetingSettings({ isRecording: !isRecording }) },
            ),
        },
        {
            key: 'captions',
            icon: IcCaptions,
            label: s.meeting_captions,
            active: activeMeeting?.settings.captionEnabled ?? false,
            binding: bindTap(
                { kind: 'action', id: 'meeting.captions.toggle' },
                {
                    params: { to: !(activeMeeting?.settings.captionEnabled ?? false) },
                    onTrigger: () => updateMeetingSettings({ captionEnabled: !(activeMeeting?.settings.captionEnabled ?? false) }),
                },
            ),
        },
        { key: 'transcript', icon: IcSubtitles, label: s.meeting_text_transcription },
        { key: 'red-packet', icon: IcShare, label: s.meeting_reaction_flowers },
        { key: 'poll', icon: IcLayout, label: s.meeting_poll },
        { key: 'beauty', icon: IcSmile, label: s.meeting_beauty },
        { key: 'virtual-background', icon: IcImage, label: s.meeting_virtual_background },
        {
            key: 'layout',
            icon: IcMonitor,
            label: s.meeting_mode,
            binding: bindTap(
                { kind: 'action', id: 'meeting.layout.toggle' },
                {
                    params: { to: activeMeeting?.settings.layout === 'gallery' ? 'speaker' : 'gallery' },
                    onTrigger: () => updateMeetingSettings({ layout: activeMeeting?.settings.layout === 'gallery' ? 'speaker' : 'gallery' }),
                },
            ),
        },
        { key: 'avatar', icon: IcBot, label: s.meeting_virtual_avatar },
        { key: 'badge', icon: IcBadge, label: s.meeting_name_badge },
        { key: 'disconnect-audio', icon: IcMicOff, label: s.meeting_disconnect_audio },
        { key: 'select-audio', icon: IcAudio, label: s.meeting_select_audio },
        { key: 'check-in', icon: IcCalendarDays, label: s.meeting_check_in },
        { key: 'break', icon: IcVolume, label: s.meeting_take_break },
        { key: 'settings', icon: IcSettings, label: s.menu_settings },
        { key: 'minutes', icon: IcFile, label: s.meeting_minutes },
        { key: 'ask-ai', icon: IcBot, label: s.meeting_ask_ai },
        { key: 'room', icon: IcMonitor, label: s.meeting_mode },
        { key: 'ai-transfer', icon: IcAudio, label: s.meeting_ai_transfer },
    ];

    return (
        <div className="tm-active-meeting" data-status-bar-foreground="light" data-meeting-root>
            <header className="tm-meeting-header">
                <button className="tm-header-speaker" aria-label={s.meeting_audio}>
                    <IcVolume size={23} />
                </button>
                <div className="tm-meeting-title">
                    <div>
                        <span>{s.app_name}</span>
                        <IcExpand size={14} />
                    </div>
                    <small>{duration}</small>
                </div>
                <button {...bindTap('meeting.exit.open')} className="tm-exit-trigger">
                    {isHost ? s.meeting_btn_end : s.meeting_btn_leave}
                </button>
            </header>

            <main className="tm-meeting-body">
                <div className="tm-status-strip">
                    <span className={`tm-status-chip ${isRecording ? 'is-active' : ''}`}>
                        <IcDisc size={15} />
                        {isRecording ? s.meeting_recording_active : s.meeting_recording_ready}
                        <IcExpand size={13} />
                    </span>
                    <span className="tm-status-chip">
                        <IcMonitor size={15} />
                        {s.meeting_devices_joined.replace('%s', String(deviceCount))}
                    </span>
                </div>

                {primaryParticipant && !isEntering && (
                    <button
                        className="tm-secondary-device"
                        {...bindTap('meeting.member.open', { params: { member: primaryParticipant.id } })}
                    >
                        <ParticipantAvatar participant={primaryParticipant} compact />
                        <span className="tm-secondary-device-name">
                            <span className="tm-secondary-device-badge"><IcParticipants size={11} /></span>
                            {primaryParticipant.name}
                        </span>
                    </button>
                )}

                <section className="tm-main-stage">
                    {isEntering || !primaryParticipant ? (
                        <span className="tm-entering">{s.meeting_entering}</span>
                    ) : (
                        <button
                            className="tm-primary-participant"
                            {...bindTap('meeting.member.open', { params: { member: primaryParticipant.id } })}
                        >
                            <ParticipantAvatar participant={primaryParticipant} />
                            <span className="tm-participant-name">
                                {isMuted ? <IcMicOff size={14} /> : <IcMic size={14} />}
                                {primaryParticipant.name}
                                <IcShare size={13} />
                            </span>
                        </button>
                    )}
                </section>

                <section className="tm-folded-summary" aria-label={s.meeting_minutes_title}>
                    <div>
                        <strong>{s.meeting_minutes_title}</strong>
                        <span>{s.meeting_only_visible}</span>
                        <button>{s.meeting_hide}</button>
                    </div>
                    <p>{s.meeting_minutes_generating}</p>
                </section>

                <div className="tm-assistant-rail">
                    <div className="tm-assistant-left">
                        <button className="tm-assistant-button"><IcSubtitles size={21} /><span className="tm-live-dot" /></button>
                        <span className="tm-assistant-divider" />
                        <button className="tm-assistant-button" {...bindTap('meeting.chat.open')}><IcMessage size={21} /></button>
                        <button className="tm-assistant-button"><IcSmile size={22} /></button>
                    </div>
                    <button className="tm-assistant-button tm-assistant-notes"><IcFile size={21} /><span className="tm-live-dot" /></button>
                </div>
            </main>

            <nav className="tm-control-bar" aria-label={s.app_name}>
                <button
                    {...bindTap(
                        { kind: 'action', id: 'meeting.microphone.toggle' },
                        { params: { to: !isMuted }, onTrigger: () => updateMeetingSettings({ isMuted: !isMuted }) },
                    )}
                    className="tm-control-item"
                >
                    {isMuted ? <IcMicOff className="is-danger" /> : <IcMic />}
                    <span>{isMuted ? s.meeting_unmute : s.meeting_mute}</span>
                </button>
                <button
                    {...bindTap(
                        { kind: 'action', id: 'meeting.video.toggle' },
                        { params: { to: !isVideoOn }, onTrigger: () => updateMeetingSettings({ isVideoOn: !isVideoOn }) },
                    )}
                    className="tm-control-item"
                >
                    {isVideoOn ? <IcVideo /> : <IcVideoOff className="is-danger" />}
                    <span>{isVideoOn ? s.meeting_video_on : s.meeting_video_off}</span>
                </button>
                <button
                    {...bindTap(
                        { kind: 'action', id: 'meeting.sharing.toggle' },
                        { params: { to: !isSharing }, onTrigger: () => updateMeetingSettings({ isSharing: !isSharing }) },
                    )}
                    className="tm-control-item"
                >
                    {isSharing ? <IcStopCircle className="is-danger" /> : <IcScreenShare className="is-share" />}
                    <span>{isSharing ? s.meeting_stop_share : s.meeting_share_screen}</span>
                </button>
                <button {...bindTap('meeting.members.open')} className="tm-control-item">
                    <IcParticipants />
                    <span>{s.meeting_manage_members}({participantCount})</span>
                </button>
                <button {...bindTap('meeting.more.open')} className="tm-control-item">
                    <span className="tm-more-icon"><IcMenu /><i /></span>
                    <span>{s.meeting_more}</span>
                </button>
            </nav>

            {dialog === 'more' && (
                <div className="tm-panel-backdrop tm-panel-backdrop--more" {...bindBack<HTMLDivElement>()}>
                    <section
                        className="tm-more-panel"
                        data-meeting-panel="more"
                        onClick={event => event.stopPropagation()}
                    >
                        <div className="tm-more-grid">
                            {moreTools.map(tool => {
                                const Icon = tool.icon;
                                return (
                                    <button key={tool.key} className={`tm-more-tool ${tool.active ? 'is-active' : ''}`} {...(tool.binding ?? {})}>
                                        <span><Icon size={25} /></span>
                                        <small>{tool.label}</small>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="tm-more-extension">
                            <span />
                            <small>{s.meeting_app_market}</small>
                            <span />
                        </div>
                        <div className="tm-reaction-row">
                            {[
                                ['👌', s.meeting_reaction_ok],
                                ['💐', s.meeting_reaction_flowers],
                                ['➕', s.meeting_reaction_plus_one],
                                ['👍', s.meeting_reaction_call],
                            ].map(([emoji, label]) => (
                                <button key={label}><b>{emoji}</b><small>{label}</small></button>
                            ))}
                        </div>
                        <button className="tm-more-hand"><IcHand size={24} />{s.meeting_raise_hand}</button>
                        <button className="tm-panel-cancel" {...bindBack()}>{s.btn_cancel}</button>
                    </section>
                </div>
            )}

            {dialog === 'members' && (
                <div className="tm-panel-backdrop" {...bindBack<HTMLDivElement>()}>
                    <section className="tm-side-panel tm-members-panel" data-meeting-panel="members" onClick={event => event.stopPropagation()}>
                        <div className="tm-panel-header">
                            <IcSettings size={21} />
                            <strong>{s.meeting_manage_members}</strong>
                            <button {...bindBack()}><IcClose size={23} /></button>
                        </div>
                        <div className="tm-member-search">
                            <label><IcSearch size={16} /><input placeholder={s.meeting_search_member} /></label>
                            <IcUserAdd size={23} />
                        </div>
                        <div className="tm-member-tabs">
                            <span className="is-active">{s.meeting_in_meeting_tab}({participantCount})</span>
                            <span>{s.meeting_not_joined}</span>
                        </div>
                        <div className="tm-member-list" data-scroll-container="main" data-scroll-direction="vertical">
                            {activeMeeting?.participants.map(participant => (
                                <button
                                    key={participant.id}
                                    className="tm-member-row"
                                    {...bindTap('meeting.member.open', { params: { member: participant.id } })}
                                >
                                    <ParticipantAvatar participant={participant} compact />
                                    <span className="tm-member-copy">
                                        <strong>{participant.name}</strong>
                                        <small>
                                            {participant.isHost && s.meeting_host_label}
                                            {participant.isHost && participant.id === user.id && ' · '}
                                            {participant.id === user.id && s.meeting_me_label}
                                        </small>
                                    </span>
                                    {participant.isMuted ? <IcMicOff className="is-danger" /> : <IcMic />}
                                </button>
                            ))}
                        </div>
                        <div className="tm-member-actions">
                            <button {...bindTap({ kind: 'action', id: 'meeting.members.muteAll' }, { onTrigger: () => isHost && muteAllParticipants(true) })}>{s.meeting_mute_all}</button>
                            <button {...bindTap({ kind: 'action', id: 'meeting.members.unmuteAll' }, { onTrigger: () => isHost && muteAllParticipants(false) })}>{s.meeting_unmute_all}</button>
                            <button>{s.meeting_invite}</button>
                        </div>
                    </section>
                </div>
            )}

            {dialog === 'profile' && selectedMember && (
                <div className="tm-panel-backdrop" {...bindBack<HTMLDivElement>()}>
                    <section className="tm-side-panel tm-profile-panel" data-meeting-panel="profile" onClick={event => event.stopPropagation()}>
                        <div className="tm-profile-cover">
                            <small>{s.meeting_set_bg_hint}</small>
                            <ParticipantAvatar participant={selectedMember} />
                        </div>
                        <div className="tm-profile-body">
                            <div className="tm-profile-name">
                                <strong>{selectedMember.name}</strong>
                                <span>
                                    {selectedMember.isHost && s.meeting_host_label}
                                    {selectedMember.isHost && selectedMember.id === user.id && ' · '}
                                    {selectedMember.id === user.id && s.meeting_me_label}
                                </span>
                            </div>
                            <div className="tm-profile-badges"><span>{s.meeting_free_label}</span><span>{s.account_unified_identity}</span></div>
                            <div className="tm-profile-signature"><span>{s.meeting_signature_label}</span><small>{s.me_signature_hint}</small></div>
                            <button
                                className="tm-profile-action"
                                {...bindTap(
                                    { kind: 'action', id: 'meeting.member.item.mute.toggle' },
                                    {
                                        params: { memberId: selectedMember.id, to: !selectedMember.isMuted },
                                        onTrigger: () => updateParticipant(selectedMember.id, { isMuted: !selectedMember.isMuted }),
                                    },
                                )}
                            >
                                <span>{selectedMember.isMuted ? s.meeting_unmute : s.meeting_mute}</span><IcMic size={20} />
                            </button>
                            {(selectedMember.id === user.id || isHost) && (
                                <button
                                    className="tm-profile-action"
                                    {...bindTap('meeting.member.rename.open', {
                                        params: { member: selectedMember.id },
                                        beforeTrigger: () => setRenameText(selectedMember.name),
                                    })}
                                >
                                    <span>{s.meeting_rename}</span><IcEdit2 size={20} />
                                </button>
                            )}
                        </div>
                    </section>
                </div>
            )}

            {dialog === 'rename' && selectedMember && (
                <div className="tm-panel-backdrop tm-panel-backdrop--center" {...bindBack<HTMLDivElement>()}>
                    <section className="tm-rename-dialog" data-meeting-panel="rename" onClick={event => event.stopPropagation()}>
                        <strong>{s.meeting_rename_title}</strong>
                        <input
                            autoFocus
                            value={renameText}
                            onChange={event => setRenameText(event.target.value)}
                            data-action="meeting.member.rename.input"
                            data-action-type="input"
                            data-action-params={JSON.stringify({ value: renameText })}
                        />
                        <div>
                            <button {...bindBack()}>{s.btn_cancel}</button>
                            <button
                                {...bindTap(
                                    { kind: 'action', id: 'meeting.member.rename.submit' },
                                    { params: { memberId: selectedMember.id }, onTrigger: handleRenameSubmit },
                                )}
                            >
                                {s.btn_confirm}
                            </button>
                        </div>
                    </section>
                </div>
            )}

            {dialog === 'chat' && (
                <div className="tm-panel-backdrop" {...bindBack<HTMLDivElement>()}>
                    <section className="tm-side-panel tm-chat-panel" data-meeting-panel="chat" onClick={event => event.stopPropagation()}>
                        <div className="tm-panel-header">
                            <span className="tm-chat-header-icons"><IcFile size={20} /><IcVolume size={20} /></span>
                            <strong>{s.meeting_chat_title}</strong>
                            <button {...bindBack()}><IcClose size={23} /></button>
                        </div>
                        <div ref={chatScrollRef} className="tm-chat-messages" data-scroll-container="main" data-scroll-direction="vertical">
                            <div className="tm-chat-context">
                                {recipient === 'all'
                                    ? s.meeting_chatting_with_all
                                    : `${s.meeting_chatting_with_prefix}${recipient.name}${s.meeting_chatting_with_suffix}`}
                            </div>
                            {messages.length === 0 ? (
                                <div className="tm-chat-empty">{s.meeting_no_chat_messages}</div>
                            ) : (
                                messages.map(message => (
                                    <div key={message.id} className={`tm-chat-message ${message.senderId === user.id ? 'is-mine' : ''}`}>
                                        <span className="tm-chat-avatar">{message.sender.slice(0, 2)}</span>
                                        <div>
                                            <small>
                                                {message.sender}
                                                <time>{TimeService.fromTimestamp(message.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                                                {shouldShowPrivateChatBadge(message, user.id) && <em>{s.meeting_private_chat}</em>}
                                            </small>
                                            <p>{message.text}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="tm-chat-composer">
                            <button className="tm-recipient-trigger" {...bindTap('meeting.chat.recipient.open')}>
                                <span>{s.meeting_send_to}</span>
                                <b><IcParticipants size={14} />{recipient === 'all' ? s.meeting_send_to_all : recipient.name}<IcExpand size={14} /></b>
                            </button>
                            <div className="tm-chat-input-row" data-keep-keyboard="true">
                                <IcSubtitles size={20} />
                                <label>
                                    <textarea
                                        ref={chatTextareaRef}
                                        rows={1}
                                        placeholder={s.meeting_input_placeholder}
                                        value={chatMessage}
                                        onChange={event => setChatMessage(event.target.value)}
                                        data-action="meeting.chat.message.input"
                                        data-action-type="input"
                                        data-action-params={JSON.stringify({ value: chatMessage })}
                                    />
                                </label>
                                <IcSmile size={20} />
                                {chatMessage.trim().length === 0 ? (
                                    <IcAdd size={20} />
                                ) : (
                                    <button
                                        aria-label={s.meeting_input_placeholder}
                                        {...bindTap({ kind: 'action', id: 'meeting.chat.message.submit' }, { onTrigger: handleSendMessage })}
                                        onPointerDown={event => {
                                            event.preventDefault();
                                            chatTextareaRef.current?.focus({ preventScroll: true });
                                        }}
                                        className="tm-send-button"
                                    >
                                        <span>↑</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </section>
                </div>
            )}

            {dialog === 'recipient' && (
                <div className="tm-panel-backdrop" {...bindBack<HTMLDivElement>()}>
                    <section className="tm-side-panel tm-recipient-panel" data-meeting-panel="recipient" onClick={event => event.stopPropagation()}>
                        <div className="tm-panel-header">
                            <button {...bindBack()}><IcExpand className="tm-recipient-back" size={23} /></button>
                            <strong>{s.meeting_send_to}</strong>
                            <span />
                        </div>
                        <div className="tm-member-search"><label><IcSearch size={16} /><input placeholder={s.meeting_search_member} /></label></div>
                        <div className="tm-member-list">
                            <button
                                className="tm-member-row"
                                {...bindTap(
                                    { kind: 'action', id: 'meeting.chat.recipient.item.select.all' },
                                    { params: { recipientId: 'all' }, onTrigger: () => { setRecipient('all'); back(); } },
                                )}
                            >
                                <span className="tm-everyone-avatar"><IcParticipants size={17} /></span>
                                <span className="tm-member-copy"><strong>{s.meeting_everyone}</strong></span>
                                {recipient === 'all' && <IcCheck className="is-selected" size={20} />}
                            </button>
                            {activeMeeting?.participants.filter(participant => participant.id !== user.id).map(participant => (
                                <button
                                    key={participant.id}
                                    className="tm-member-row"
                                    {...bindTap(
                                        { kind: 'action', id: 'meeting.chat.recipient.item.select.member' },
                                        {
                                            params: { recipientId: participant.id },
                                            onTrigger: () => { setRecipient({ id: participant.id, name: participant.name }); back(); },
                                        },
                                    )}
                                >
                                    <ParticipantAvatar participant={participant} compact />
                                    <span className="tm-member-copy"><strong>{participant.name}</strong></span>
                                    {recipient !== 'all' && recipient.id === participant.id && <IcCheck className="is-selected" size={20} />}
                                </button>
                            ))}
                        </div>
                    </section>
                </div>
            )}

            {dialog === 'exit' && (
                <div className="tm-panel-backdrop tm-panel-backdrop--exit" {...bindBack<HTMLDivElement>()}>
                    <section className="tm-exit-dialog" data-meeting-panel="exit" onClick={event => event.stopPropagation()}>
                        <div className="tm-exit-hint">
                            {isHost ? s.exit_host_hint : s.exit_participant_confirm}
                        </div>
                        <button>{s.exit_ai_delegate}{isHost && <IcExternalLink size={14} />}</button>
                        <button {...bindTap('meeting.leave', { beforeTrigger: () => endMeeting() })}>{s.exit_leave_meeting}</button>
                        {isHost && (
                            <button {...bindTap('meeting.leave.all', { beforeTrigger: () => endMeeting() })}>{s.exit_leave_all_devices}</button>
                        )}
                        {isHost && (
                            <button className="is-danger" {...bindTap('meeting.end', { beforeTrigger: () => endMeeting() })}>{s.exit_end_meeting}</button>
                        )}
                        <button className="tm-exit-cancel" {...bindBack()}>{s.btn_cancel}</button>
                    </section>
                </div>
            )}
        </div>
    );
};
