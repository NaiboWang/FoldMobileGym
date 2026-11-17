import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { IcNavBack, IcUser, IcCheck, IcExpand, IcAdd, IcSmile } from '../res/icons';
import { AttachmentPanel } from './AttachmentPanel';
import { ensureConversation, sendMessage, isValidPhoneNumber, useSmsStore } from '../state';
import { smsComposeDraftKey, type SmsComposeDraft } from '../composeDrafts';
import { SendArrowIcon } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useContactsList } from '../../Contacts/state';
import { filterSmsContactOptions, smsContactOptions, type SmsContactOption } from '../contactOptions';
import { useActivityContext } from '../../../os/ActivityContext';
import { useSmsGestures } from '../hooks/useSmsGestures';
import { ComposeRecipientErrorDialog } from './ComposeRecipientErrorDialog';
import { smsComposeRows } from '../composeText';
import { useSmsComposeOwner } from '../hooks/useSmsComposeOwner';
import '../compose.css';

export const NewMessagePage: React.FC = () => {
    const { go, back, bindBack, bindTap } = useSmsGestures();
    const s = useAppStrings(strings, stringsEn);
    const location = useLocation();
    const { activityId } = useActivityContext();
    const ownsCompose = useSmsComposeOwner(), composing = useRef(false);
    const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    // 接收 intent.data（外部 startActivity ACTION_VIEW scheme=sms 投递时填这里），
    // 没有则回退 URL search params（保持原 deep-link 兼容）。
    const intentData = useMemo(() => {
        const os = window.__OS__;
        const payload = os?.getIntentPayload?.(activityId) ?? os?.getIntentPayload?.('sms');
        return (payload as { data?: Record<string, any> } | null)?.data;
    }, [activityId]);
    const showAttachments = queryParams.get('panel') === 'attachments';
    const showSuggestions = queryParams.get('panel') === 'contacts';
    const showErrorDialog = queryParams.get('dialog') === 'invalidRecipient';
    const initialAddress = (typeof intentData?.address === 'string' ? intentData.address : null) ?? queryParams.get('address') ?? '';
    const initialBody = (typeof intentData?.body === 'string' ? intentData.body : null) ?? queryParams.get('body') ?? '';
    const draftKey = smsComposeDraftKey(initialAddress, initialBody);
    const seed = useMemo<SmsComposeDraft>(() => ({ recipient: initialAddress, body: initialBody, boundPhone: null }), [initialAddress, initialBody]);
    const savedDraft = useSmsStore(state => state.composeDrafts?.[draftKey]);
    const updateComposeDraft = useSmsStore(state => state.updateComposeDraft);
    const { recipient, body: message, boundPhone } = savedDraft ?? seed;
    const setMessage = (body: string) => { if (ownsCompose() && !showSuggestions && !showErrorDialog) updateComposeDraft(draftKey, seed, { body }); };
    const contacts = useContactsList();
    const allContacts = useMemo(() => smsContactOptions(contacts), [contacts]);
    const [pickerQuery, setPickerQuery] = useState(recipient);
    const [pickerSelection, setPickerSelection] = useState<string | null>(null);
    const pickerWasOpen = useRef(false);
    const filteredContacts = useMemo(() => filterSmsContactOptions(allContacts, pickerQuery), [allContacts, pickerQuery]);
    const boundOption = useMemo(
        () => allContacts.find(contact => contact.phoneNumber === boundPhone && contact.displayName === recipient) ?? null,
        [allContacts, boundPhone, recipient],
    );
    useEffect(() => {
        if (showSuggestions && !pickerWasOpen.current) {
            // A confirmed contact reopens in the complete address book with its
            // selection retained. Free-form recipient text still seeds search.
            setPickerQuery(boundOption ? '' : recipient);
            setPickerSelection(boundOption?.key ?? null);
        }
        pickerWasOpen.current = showSuggestions;
    }, [boundOption, recipient, showSuggestions]);
    useEffect(() => {
        if (pickerSelection && !allContacts.some(contact => contact.key === pickerSelection)) {
            setPickerSelection(null);
        }
    }, [allContacts, pickerSelection]);
    const openSuggestions = () => {
        if (!showSuggestions && !showErrorDialog) go('compose.contacts.open');
    };

    const handleRecipientChange = (value: string) => {
        updateComposeDraft(draftKey, seed, { recipient: value, boundPhone: null });
        if (value.trim()) openSuggestions();
    };

    const handleSelectContact = (contact: SmsContactOption) => {
        updateComposeDraft(draftKey, seed, { recipient: contact.displayName, boundPhone: contact.phoneNumber });
        setPickerSelection(contact.key);
    };

    const handleSend = () => {
        if (!ownsCompose() || composing.current || showSuggestions || showErrorDialog) return;
        const currentDraft = useSmsStore.getState().composeDrafts?.[draftKey] ?? seed;
        const trimmedRecipient = currentDraft.recipient.trim(), content = currentDraft.body.trim();
        if (!trimmedRecipient || !content) return;
        let phoneNumber = currentDraft.boundPhone;
        if (!phoneNumber && isValidPhoneNumber(trimmedRecipient)) {
            phoneNumber = trimmedRecipient;
        }
        if (!phoneNumber) {
            go('compose.invalidRecipient.open');
            return;
        }
        const convId = ensureConversation(trimmedRecipient, phoneNumber);
        if (!convId) return;
        sendMessage(convId, content);
        setMessage('');
        go('conversation.open.fromNew', { conversationId: convId }, showAttachments ? { popTo: '/new', popToInclusive: true } : undefined);
    };

    const canSend = recipient.trim().length > 0 && message.trim().length > 0;

    if (showSuggestions) {
        return (
            <div className="sms-contact-picker h-full" data-status-bar-foreground="dark" data-navigation-bar-foreground="dark">
                <div className="sms-contact-picker-status" />
                <header className="sms-contact-picker-header">
                    <button className="sms-contact-picker-cancel" {...bindBack()}>
                        {pickerSelection ? s.contacts_selected_count.replace('{count}', '1') : s.contacts_unselected}
                    </button>
                    <button
                        className="sms-contact-picker-confirm"
                        data-sms-contact-picker-confirm
                        aria-label={s.confirm_contact_selection}
                        {...bindBack()}
                    >
                        <IcCheck size={21} />
                    </button>
                </header>
                <div className="sms-contact-picker-tabs" aria-label={s.contact_picker_tabs}>
                    <span>{s.contact_tab_recent}</span>
                    <span className="is-active">{s.contact_tab_contacts}</span>
                    <span>{s.contact_tab_groups}</span>
                </div>
                <div className="sms-contact-picker-search">
                    <span aria-hidden="true">⌕</span>
                    <input
                        type="text"
                        data-benchmark-field="sms-recipient"
                        aria-label={s.search_contacts}
                        value={pickerQuery}
                        onChange={event => setPickerQuery(event.target.value)}
                        placeholder={s.search_contacts}
                    />
                    {pickerQuery ? <button aria-label={s.clear_search} onClick={() => setPickerQuery('')}>×</button> : null}
                </div>
                {pickerQuery ? (
                    <div className="sms-contact-picker-safety" aria-label={s.safe_contact_access}>
                        <span>✓</span>
                        <div><strong>{s.safe_contact_access}</strong><small>{s.safe_contact_access_desc}</small></div>
                    </div>
                ) : null}
                <div className="sms-contact-picker-count">{s.contact_result_count.replace('{count}', String(filteredContacts.length))}</div>
                <div className="sms-contact-picker-list" data-scroll-container="main" data-scroll-direction="vertical">
                    {filteredContacts.length === 0 && <p role="status" className="sms-compose-empty-contacts">{s.empty_contact_results}</p>}
                    {filteredContacts.map((contact) => {
                        const selected = pickerSelection === contact.key;
                        return (
                            <button
                                key={contact.key}
                                className="sms-contact-picker-row"
                                data-selected={selected || undefined}
                                {...bindTap({ kind: 'action', id: 'sms.compose.recipient.select' }, {
                                    params: { contactId: contact.contactId, number: contact.phoneNumber },
                                    onTrigger: () => handleSelectContact(contact),
                                })}
                            >
                                <span className="sms-contact-picker-avatar" style={{ backgroundColor: contact.avatarColor || '#aeb7cc' }}>
                                    {contact.displayName.charAt(0)}
                                </span>
                                <span className="sms-contact-picker-copy">
                                    <strong>{contact.displayName}</strong>
                                    <small>{contact.phoneNumber}</small>
                                </span>
                                <span className="sms-contact-picker-radio" aria-hidden="true">{selected ? '✓' : ''}</span>
                            </button>
                        );
                    })}
                </div>
                <div className="sms-contact-picker-footer" aria-hidden="true"><IcUser size={20} /><small>{s.contact_tab_contacts}</small></div>
            </div>
        );
    }

    return (
        <div className="sms-compose-root h-full bg-app-surface flex flex-col">
          <div inert={showErrorDialog || undefined} style={{ display: 'contents' }}>
            {/* Status bar spacer */}
            <div className="h-12 flex-shrink-0" />

            {/* Header */}
            <div className="sms-compose-header flex items-center px-4 h-12 flex-shrink-0">
                <button className="sms-pane-back w-10 h-10 -ml-2 flex items-center justify-center" {...bindBack()}>
                    <IcNavBack size={24} className="text-app-text" />
                </button>
            </div>

            {/* Title */}
            <div className="sms-compose-title px-6 pt-2 pb-4 flex-shrink-0">
                <h1 className="text-[28px] font-bold text-app-text leading-tight">{s.new_message_title}</h1>
            </div>

            {/* Recipient input */}
            <div className="sms-compose-recipient-shell px-6 flex-shrink-0 border-b border-gray-100">
                <div className="sms-compose-recipient-row py-3">
                    <span className="text-[16px] text-gray-400 mr-2">{s.recipient_label}</span>
                    <input
                        type="text"
                        data-benchmark-field="sms-recipient"
                        aria-label={s.recipient_label}
                        value={recipient}
                        onChange={(e) => handleRecipientChange(e.target.value)}
                        onFocus={() => { if (recipient.trim()) openSuggestions(); }}
                        className="flex-1 text-[16px] text-app-text outline-none"
                        placeholder=""
                    />
                    <button
                        type="button"
                        className="w-10 h-10 flex items-center justify-center text-app-text-muted"
                        aria-label={showSuggestions ? s.cancel : s.pick_contact_title}
                        {...(showSuggestions ? bindBack() : bindTap('compose.contacts.open'))}
                    >
                        {showSuggestions ? (
                            <IcCheck size={22} className="text-blue-500" />
                        ) : (
                            <IcAdd size={24} />
                        )}
                    </button>
                </div>
            </div>
            <>
                <div className="flex-1" />
                {/* Bottom input area */}
                <div className="sms-compose-composer flex-shrink-0 border-t border-gray-100 bg-app-bg" data-keep-keyboard="true">
                    {showAttachments && <AttachmentPanel />}
                    <div className="flex items-center px-3 py-2 gap-2">
                            <button
                                className="sms-composer-attachment w-11 h-11 flex items-center justify-center bg-app-surface rounded-full"
                                aria-label={showAttachments ? s.cancel : s.attachments_title}
                                {...(showAttachments ? bindBack() : bindTap('compose.attachments.open'))}
                            >
                                {showAttachments ? (
                                    <IcExpand size={20} className="text-gray-600" />
                                ) : (
                                    <IcAdd size={23} />
                                )}
                            </button>
                            <div className="flex-1 bg-app-surface rounded-full flex items-center px-4 py-2.5">
                                <textarea
                                    rows={smsComposeRows(message)}
                                    data-benchmark-field="sms-body"
                                    aria-label={s.sms_placeholder}
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    onCompositionStart={() => { composing.current = true; }}
                                    onCompositionEnd={e => { composing.current = false; setMessage(e.currentTarget.value); }}
                                    onBlur={() => { composing.current = false; }}
                                    className="flex-1 min-w-0 resize-none text-[14px] text-app-text outline-none"
                                    placeholder={s.sms_placeholder}
                                />
                                <span className="ml-2 text-app-text-muted" aria-hidden="true"><IcSmile size={21} /></span>
                            </div>
                            <button
                                className={`w-11 h-11 flex items-center justify-center rounded-full ${canSend ? 'bg-app-primary' : 'bg-gray-200'}`}
                                onPointerDown={(e) => e.preventDefault()}
                                aria-label={s.action_send}
                                {...(showAttachments
                                    ? bindTap({ kind: 'action', id: 'sms.compose.attachments.send.submit' }, { onTrigger: handleSend })
                                    : bindTap({ kind: 'action', id: 'sms.compose.send.submit' }, { onTrigger: handleSend }))}
                                aria-disabled={!canSend}
                            >
                                <SendArrowIcon active={canSend} />
                            </button>
                    </div>
                </div>
            </>

          </div>
          {showErrorDialog && <ComposeRecipientErrorDialog />}
        </div>
    );
};
