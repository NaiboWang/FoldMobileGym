import React, { useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { QrCode, SquarePen, Star, UserRound, Video } from 'lucide-react';
import { Toast } from '@/os/components/Toast';
import { useLocale } from '@/os/locale';
import { useAppStrings } from '@/os/useAppStrings';
import { SymbolIcon } from '../components/SymbolIcon';
import { CONTACTS_CONFIG } from '../data';
import { useContactsGestures } from '../hooks/useContactsGestures';
import { toggleStarred, useContact } from '../state';
import { ChevronRightIcon, IcSymbolBack, IcSymbolDelete, IcSymbolMessages, IcSymbolMore, IcSymbolPhone } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { localizeContactLabel } from '../utils/localizedText';
import { primaryContactPhone } from '../utils/contactPhone';
import { useContactDetailOwner } from '../hooks/useContactDetailOwner';
import { isFavoriteContactOrigin } from '../utils/detailOrigin';
import { useContactDetailViewport } from '../hooks/useContactDetailViewport';
import { contactSmsPhones } from '../utils/smsPhoneChoice';
import { contactEmailIntent } from '../utils/contactEmailIntent';

function normalizeNumber(value: string): string {
  return (value || '').replace(/\s+/g, '');
}

const CallTypeBadge: React.FC<{ type: 'incoming' | 'outgoing' | 'missed' | string }> = ({ type }) => {
  const color = type === 'missed' ? '#FF4D2D' : '#9CA3AF';
  const path = type === 'outgoing' ? 'M7 17l10-10M9 7h8v8' : 'M17 7L7 17M15 17H7V9';
  return (
    <span className="w-9 h-9 rounded-full bg-black/5 flex items-center justify-center flex-shrink-0" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d={path} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
};

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <div className="contacts-reference-section-header px-6 pt-4 pb-2 text-[12px] text-gray-400">{title}</div>
);

export const ContactDetailPage: React.FC = () => {
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const { contactId } = useParams<{ contactId: string }>();
  const [searchParams] = useSearchParams();
  const favoritesOrigin = isFavoriteContactOrigin(searchParams);
  const { bindBack, bindTap, go } = useContactsGestures();
  const s = useAppStrings(strings, stringsEn);
  const contact = useContact(contactId);
  const detailScrollRef = useContactDetailViewport(contact);
  const ownsDetail = useContactDetailOwner(contact);
  // Keep hook order stable when an externally opened/deleted contact is absent.
  const relatedCallLogs = useMemo(() => {
    const numbers = (contact?.phones || []).map((phone) => normalizeNumber(phone.number)).filter(Boolean);
    if (!numbers.length) return [];
    return CONTACTS_CONFIG.callLogs
      .filter((entry) => numbers.includes(normalizeNumber(entry.number)))
      .slice(0, 6);
  }, [contact?.phones]);

  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const qrPhone = primaryContactPhone(contact?.phones ?? []);
  const toastTimerRef = useRef<number | null>(null);
  const openingEmail = useRef(false);
  const showToast = (message: string) => {
    setToast({ visible: true, message });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast({ visible: false, message: '' }), 1400);
  };

  if (!contact) {
    return (
      <div className="h-full w-full bg-app-surface">
        <div className="h-10" />
        <div className="px-4 h-12 flex items-center gap-2">
          <button
            type="button"
            {...bindBack<HTMLButtonElement>({ stopPropagation: true })}
            className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5"
            aria-label={isEnglish ? 'Back' : '返回'}
          >
            <SymbolIcon name={IcSymbolBack} size={22} className="text-app-text" />
          </button>
          <div className="text-[16px] text-app-text font-semibold">{s.contactsList}</div>
        </div>
        <div className="px-6 py-10 text-[13px] text-gray-400">{s.contact_not_found}</div>
      </div>
    );
  }

  const primaryPhone = qrPhone;
  const smsPhones = contactSmsPhones(contact.phones);
  const openSms = (number: string) => {
    if (!ownsDetail()) return;
    const address = normalizeNumber(number);
    if (!address) { showToast(s.contact_no_phone); return; }
    // Borrow a compose Activity so back returns here without replacing a warm SMS task.
    window.__OS__?.startActivity({ action: 'ACTION_VIEW', scheme: 'sms', data: { address } });
  };

  return (
    <div className="contacts-reference-detail h-full w-full bg-app-bg flex flex-col" data-benchmark-source-id={contact.id}>
      <Toast visible={toast.visible} message={toast.message} />

      <div className="sticky top-0 z-30 bg-app-bg">
        <div className="h-10" />
        <div className="px-3 h-12 flex items-center">
          <button
            type="button"
            {...bindBack<HTMLButtonElement>({ stopPropagation: true })}
            className="contacts-detail-back w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5"
            aria-label={isEnglish ? 'Back' : '返回'}
          >
            <SymbolIcon name={IcSymbolBack} size={22} className="text-app-text" />
          </button>
          <div className="flex-1" />
          <button
            type="button"
            aria-label={isEnglish ? 'QR code' : '二维码'}
            className="contacts-detail-qr w-10 h-10 rounded-full flex items-center justify-center"
            {...bindTap('contact.qr.open', { onTrigger: () => { if (ownsDetail()) go('contact.qr.open', { contactId: contact.id }); } })}
          >
            <QrCode size={22} strokeWidth={1.9} className="text-gray-800" />
          </button>
          {!favoritesOrigin && <button
            type="button"
            aria-label={isEnglish ? 'Favorite' : '收藏'}
            className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5"
            {...bindTap({ kind: 'action', id: 'contacts.contact.favorite.toggle' }, { params: { contactId: contact.id }, onTrigger: () => { if (ownsDetail()) toggleStarred(contact.id); } })}
          >
            <Star size={22} strokeWidth={1.8} fill={contact.starred ? 'currentColor' : 'none'} className={contact.starred ? 'text-[#18c765]' : 'text-gray-800'} />
          </button>}
          {!favoritesOrigin && <button
            type="button"
            aria-label={s.edit}
            className="contacts-detail-edit w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5"
            {...bindTap('contact.edit.open', { params: { contactId: contact.id }, onTrigger: () => { if (ownsDetail()) go('contact.edit.open', { contactId: contact.id }); } })}
          >
            <SquarePen size={22} strokeWidth={1.9} className="text-gray-800" />
          </button>}
          {!favoritesOrigin && <button
            type="button"
            aria-label={isEnglish ? 'More' : '更多'}
            className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5"
            {...bindTap('contact.menu.open', { params: { contactId: contact.id }, onTrigger: () => { if (ownsDetail()) go('contact.menu.open', { contactId: contact.id }); } })}
          >
            <SymbolIcon name={IcSymbolMore} size={20} className="text-gray-700" />
          </button>}
        </div>
      </div>

      <div ref={detailScrollRef} className="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-10" data-scroll-container="main" data-scroll-direction="vertical">
        <div className="pt-3">
          <div className="flex flex-col items-center px-6">
            <div
              className="contacts-reference-avatar w-(--app-contact-detail-avatar-size) h-(--app-contact-detail-avatar-size) rounded-full flex items-center justify-center text-white text-[28px] font-semibold"
              style={{ backgroundColor: contact.avatarColor || '#9CA3AF' }}
            >
              {contact.avatarUri ? (
                <img
                  src={contact.avatarUri}
                  alt=""
                  className="w-full h-full rounded-full object-cover"
                  draggable={false}
                />
              ) : favoritesOrigin ? (
                <span aria-hidden="true">{Array.from(contact.displayName.trim())[0] || '#'}</span>
              ) : (
                <UserRound size={62} strokeWidth={1.25} aria-hidden="true" />
              )}
            </div>

            <div className="contacts-reference-name mt-3 text-center text-[22px] font-semibold text-app-text">{contact.displayName}</div>
            {contact.company || contact.title ? (
              <div className="contacts-reference-fact contacts-reference-organization mt-1 text-center text-[13px] text-gray-400">
                {[contact.company, contact.title].filter(Boolean).join(' / ')}
              </div>
            ) : null}
          </div>

          <div className="px-4 mt-4">
            <div className="contacts-reference-actions bg-app-surface rounded-3xl overflow-hidden">
              <button
                type="button"
                className="w-full px-5 py-4 flex items-center justify-between active:bg-black/5 text-left"
                disabled={!primaryPhone.trim()}
                {...bindTap('contact.dial.open', { params: { number: primaryPhone }, onTrigger: () => { if (ownsDetail()) go('contact.dial.open', { number: primaryPhone }); } })}
              >
                <span className="text-[16px] font-semibold text-app-text">{s.action_call}</span>
                <span className="inline-flex items-center gap-2">
                  <SymbolIcon name={IcSymbolPhone} size={18} className="text-gray-700" />
                  <ChevronRightIcon />
                </span>
              </button>
              <div className="h-px bg-black/5 ml-5" />
              <button
                type="button"
                className="w-full px-5 py-4 flex items-center justify-between active:bg-black/5 text-left"
                disabled={!primaryPhone.trim()}
                {...(smsPhones.length > 1
                  ? bindTap('contact.sms.picker.open', { params: { contactId: contact.id }, onTrigger: () => {
                    if (ownsDetail()) { window.__OS__?.keyboard.hide(); go('contact.sms.picker.open', { contactId: contact.id }); }
                  } })
                  : bindTap({ kind: 'action', id: 'contacts.contact.sms.open' }, {
                    params: { contactId: contact.id, number: primaryPhone }, onTrigger: () => openSms(primaryPhone),
                  }))}
              >
                <span className="text-[16px] font-semibold text-app-text">{s.action_sms}</span>
                <span className="inline-flex items-center gap-2">
                  <SymbolIcon name={IcSymbolMessages} size={18} className="text-gray-700" />
                  <ChevronRightIcon />
                </span>
              </button>
              <button
                type="button"
                className="contacts-reference-video w-full px-5 py-4 flex items-center justify-between text-left"
                disabled
              >
                <span className="text-[16px] font-semibold text-app-text">{s.action_video}</span>
                <span className="inline-flex items-center gap-2">
                  <Video size={19} strokeWidth={1.8} className="text-gray-400" />
                </span>
              </button>
            </div>
          </div>
        </div>

        {contact.phones?.length ? (
          <div className="contacts-reference-phone-section mt-2">
            <SectionHeader title={s.section_phones} />
            <div className="mx-4 bg-app-surface rounded-3xl overflow-hidden">
              {contact.phones.map((phone, index) => (
                <React.Fragment key={phone.id}>
                  <div
                    className="w-full px-5 py-4 flex items-center justify-between active:bg-black/5 text-left"
                  >
                    <button type="button" className="flex-1 min-w-0 pr-3 text-left" disabled={!phone.number.trim()}
                      {...bindTap('contact.dial.open', { params: { number: phone.number }, onTrigger: () => { if (ownsDetail()) go('contact.dial.open', { number: phone.number }); } })}>
                      <div className="contacts-reference-fact text-[16px] text-app-text">{phone.number}</div>
                      <div className="text-[12px] text-gray-400 mt-0.5">
                        {localizeContactLabel(phone.label || '手机', locale)}
                      </div>
                    </button>
                    <div className="contacts-reference-phone-actions flex items-center gap-3">
                      <button
                        type="button"
                        aria-label={isEnglish ? 'Call' : '拨打'}
                        disabled={!phone.number.trim()}
                        className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5"
                        {...bindTap('contact.dial.open', { params: { number: phone.number }, stopPropagation: true, onTrigger: () => { if (ownsDetail()) go('contact.dial.open', { number: phone.number }); } })}
                      >
                        <SymbolIcon name={IcSymbolPhone} size={18} className="text-gray-700" />
                      </button>
                      <button
                        type="button"
                        aria-label={isEnglish ? 'SMS' : '短信'}
                        disabled={!phone.number.trim()}
                        className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5"
                        {...bindTap({ kind: 'action', id: 'contacts.contact.sms.open' }, {
                          params: { contactId: contact.id, number: phone.number }, stopPropagation: true,
                          onTrigger: () => openSms(phone.number),
                        })}
                      >
                        <SymbolIcon name={IcSymbolMessages} size={18} className="text-gray-700" />
                      </button>
                      <ChevronRightIcon />
                    </div>
                  </div>
                  {index < contact.phones.length - 1 ? <div className="h-px bg-black/5 ml-5" /> : null}
                </React.Fragment>
              ))}
            </div>
          </div>
        ) : null}

        <div className="contacts-reference-ringtone mx-4 mt-3 bg-app-surface rounded-3xl px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-[16px] text-app-text">{s.default_ringtone}</div>
            <div className="text-[12px] text-gray-400 mt-0.5">{s.phone_ringtone}</div>
          </div>
          <ChevronRightIcon />
        </div>

        {(contact.emails ?? []).length ? (
          <div className="mt-2">
            <SectionHeader title={s.section_email} />
            <div className="mx-4 bg-app-surface rounded-3xl overflow-hidden">
              {(contact.emails ?? []).map((email, index) => {
                const expectedId = email.id, expectedAddress = email.email;
                return (
                <React.Fragment key={email.id}>
                  <button
                    type="button"
                    className="w-full px-5 py-4 flex items-center justify-between active:bg-black/5 text-left"
                    {...bindTap<HTMLButtonElement>({ kind: 'action', id: 'contacts.contact.email.open' }, {
                      params: { contactId: contact.id, email: email.email },
                      onTrigger: async () => {
                        if (!ownsDetail() || openingEmail.current) return;
                        const intent = contactEmailIntent(contact, email, expectedId, expectedAddress);
                        if (!intent) { showToast(s.contact_email_unavailable); return; }
                        openingEmail.current = true;
                        try {
                          const opened = await window.__OS__?.startActivity(intent);
                          if (!opened && ownsDetail()) showToast(s.contact_email_unavailable);
                        } catch { if (ownsDetail()) showToast(s.contact_email_unavailable); }
                        finally { openingEmail.current = false; }
                      },
                    })}
                  >
                    <div className="min-w-0 pr-3">
                      <div className="text-[16px] text-app-text truncate">{email.email}</div>
                      <div className="text-[12px] text-gray-400 mt-0.5">
                        {localizeContactLabel(email.label || '工作', locale)}
                      </div>
                    </div>
                    <ChevronRightIcon />
                  </button>
                  {index < (contact.emails ?? []).length - 1 ? <div className="h-px bg-black/5 ml-5" /> : null}
                </React.Fragment>
              ); })}
            </div>
          </div>
        ) : null}

        {contact.notes ? (
          <div className="mt-2">
            <SectionHeader title={s.section_notes} />
            <div className="contacts-reference-fact mx-4 bg-app-surface rounded-3xl overflow-hidden px-5 py-4 text-[14px] text-app-text whitespace-pre-wrap">
              {contact.notes}
            </div>
          </div>
        ) : null}

        <div className="mt-2">
          <SectionHeader title={s.section_call_logs} />
          <div className="mx-4 bg-app-surface rounded-3xl overflow-hidden">
            {relatedCallLogs.length ? (
              relatedCallLogs.map((entry, index) => (
                <div key={entry.id}>
                  <button
                    type="button"
                    className="w-full px-5 py-4 flex items-center justify-between active:bg-black/5 text-left"
                    {...bindTap('contact.call.open', { params: { callLogId: entry.id }, onTrigger: () => { if (ownsDetail()) go('contact.call.open', { callLogId: entry.id }); } })}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CallTypeBadge type={entry.type ?? 'incoming'} />
                      <div className="min-w-0">
                        <div className="text-[15px] font-semibold text-app-text truncate">{entry.dateText}</div>
                        <div className="text-[12px] text-gray-400 mt-0.5 truncate">
                          {entry.locationText || ({
                            incoming: s.call_type_incoming,
                            outgoing: s.call_type_outgoing,
                            missed: s.call_type_missed,
                          }[entry.type as string] ?? s.call_type_normal)}
                        </div>
                      </div>
                    </div>
                    <ChevronRightIcon />
                  </button>
                  {index < relatedCallLogs.length - 1 ? <div className="h-px bg-black/5 ml-5" /> : null}
                </div>
              ))
            ) : (
              <div className="px-5 py-4 text-[13px] text-gray-400">{s.contact_no_call_logs}</div>
            )}
          </div>
        </div>

        <div className="mx-4 mt-4">
          <button
            type="button"
            className="w-full h-12 rounded-2xl bg-app-surface text-red-500 font-semibold flex items-center justify-center gap-2 active:bg-black/5"
            {...bindTap('contact.delete.open', { params: { contactId: contact.id }, onTrigger: () => { if (ownsDetail()) go('contact.delete.open', { contactId: contact.id }); } })}
          >
            <SymbolIcon name={IcSymbolDelete} size={18} className="text-red-500" />
            <span>{s.contact_delete_btn}</span>
          </button>
        </div>
      </div>
      {favoritesOrigin ? <div className="contacts-detail-footer flex-shrink-0 bg-app-surface border-t border-black/5 flex items-center justify-around px-6 py-3">
        <button type="button" aria-label={s.favoritesList} aria-pressed={Boolean(contact.starred)} className="flex flex-col items-center gap-1 text-[12px] text-app-text"
          {...bindTap({ kind: 'action', id: 'contacts.contact.favorite.toggle' }, { params: { contactId: contact.id }, onTrigger: () => { if (ownsDetail()) toggleStarred(contact.id); } })}>
          <Star size={22} strokeWidth={1.8} fill={contact.starred ? 'currentColor' : 'none'} className={contact.starred ? 'text-[#18c765]' : 'text-gray-800'} />
          <span>{s.favoritesList}</span>
        </button>
        <button type="button" aria-label={s.edit} className="flex flex-col items-center gap-1 text-[12px] text-app-text" {...bindTap('contact.edit.open', { params: { contactId: contact.id }, onTrigger: () => { if (ownsDetail()) go('contact.edit.open', { contactId: contact.id }); } })}>
          <SquarePen size={22} strokeWidth={1.9} className="text-gray-800" />
          <span>{s.edit}</span>
        </button>
        <button type="button" aria-label={s.contact_more_action} className="flex flex-col items-center gap-1 text-[12px] text-app-text" {...bindTap('contact.menu.open', { params: { contactId: contact.id }, onTrigger: () => { if (ownsDetail()) go('contact.menu.open', { contactId: contact.id }); } })}>
          <SymbolIcon name={IcSymbolMore} size={20} className="text-gray-700" />
          <span>{s.contact_more_action}</span>
        </button>
      </div> : null}
    </div>
  );
};
