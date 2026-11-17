import { useCalendarEventId } from '../hooks/useCalendarEventId';
import { useCalendarMainScrollName } from '../components/CalendarSurfaceContext';
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { MaskIcon } from '../components/MaskIcon';
import { useCalendarStore } from '../state';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useCalendarGestures } from '../hooks/useCalendarGestures';
import { useLocale } from '@/os/locale';
import { formatCalendarRange } from '../eventRange';
import { CalendarDeleteDialog } from '../components/CalendarDeleteDialog';
const calIcon = (name: string) => name ? `/@app-assets/Calendar/icons/${name}.svg` : '';

export const CalendarEventDetailPage: React.FC = () => {
    const mainScrollName = useCalendarMainScrollName();
  const { bindBack, bindTap } = useCalendarGestures();
  const eventId = useCalendarEventId();
  const [searchParams] = useSearchParams();
  const showDeleteConfirm = searchParams.get('deleteConfirm') === 'open';
  const calendarEvents = useCalendarStore(s => s.events);
  const s = useAppStrings(strings, stringsEn);
  const locale = useLocale();

  const formatReminderLabel = (minutesBefore: number | null | undefined): string => {
    if (minutesBefore === undefined) return '';
    if (minutesBefore === null) return s.remind_none;
    if (minutesBefore === 0) return s.label_at_start;
    if (minutesBefore === 60) return s.remind_1_hour_before;
    if (minutesBefore === 24 * 60) return s.remind_1_day_before;
    return `${s.remind_before_prefix}${minutesBefore}${s.remind_before_suffix_min}`;
  };

  const event = eventId ? calendarEvents.find(e => e.id === eventId) : undefined;

  const range = event ? formatCalendarRange(event.startTs, event.endTs, event.allDay, locale) : null;

  if (!event) {
    return (
      <div className="calendar-event-detail relative flex flex-col h-full bg-app-surface dark:bg-black text-black dark:text-white pt-10">
        <div inert={showDeleteConfirm || undefined} style={{ display: 'contents' }}>
        <div className="flex items-center px-4 py-3 shrink-0">
          <button
            {...bindBack()}
            className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5 dark:active:bg-white/5 text-gray-700 dark:text-gray-200"
          >
            <MaskIcon src={calIcon('miuix_action_icon_back_light')} size={22} />
          </button>
          <h1 className="ml-2 text-[17px] font-medium">{s.event_detail}</h1>
        </div>
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">{s.event_not_found}</div>
        </div>
        {showDeleteConfirm && <CalendarDeleteDialog eventId={eventId ?? ''} />}
      </div>
    );
  }

  return (
    <div className="calendar-event-detail relative flex flex-col h-full bg-app-bg dark:bg-black text-black dark:text-white" data-benchmark-source-id={event.id}>
      <div inert={showDeleteConfirm || undefined} style={{ display: 'contents' }}>
      {/* Top close */}
      <div className="calendar-detail-top-close pt-10 px-4 pb-2 shrink-0">
        <button
          {...bindBack()}
          className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5 dark:active:bg-white/5 text-gray-700 dark:text-gray-200"
          aria-label={s.close}
        >
          <MaskIcon src={calIcon('miuix_action_icon_immersion_close_light')} size={22} />
        </button>
      </div>

      {/* Card */}
      <div className="calendar-event-detail-content flex-1 overflow-y-auto px-4 pb-24" data-scroll-container={mainScrollName} data-scroll-direction="vertical">
        <div className="bg-app-surface dark:bg-[#1c1c1e] rounded-3xl overflow-hidden shadow-sm border border-gray-100 dark:border-white/10">
          <div className="px-5 pt-5 pb-4">
            <div className="text-[20px] font-semibold text-app-text dark:text-gray-100 break-words">{event.title}</div>
            <div className="text-[13px] text-gray-400 mt-1 break-words">
              {range ? <><p data-calendar-range-start>{s.label_start_time}: {range.start}</p><p data-calendar-range-end>{s.label_end_time}: {range.end}</p></> : s.detail_time_unavailable}
              {event.allDay && <p data-calendar-all-day-boundary>{s.label_all_day_value} · {s.detail_all_day_boundary}</p>}
            </div>
          </div>

          <div className="h-px bg-gray-100 dark:bg-white/10 mx-5" />

          <div className="px-5 py-4">
            <div className="text-[13px] text-app-text-muted dark:text-gray-400">{s.label_calendar_account}</div>
            <div className="text-[15px] text-app-text dark:text-gray-100 mt-1 break-words">
              {event.calendarAccount ?? s.default_account}
            </div>
          </div>

          {event.location && <>
            <div className="h-px bg-gray-100 dark:bg-white/10 mx-5" />
            <div className="px-5 py-4"><div className="text-[13px] text-app-text-muted dark:text-gray-400">{s.detail_location_label}</div>
              <div data-calendar-location className="text-[15px] text-app-text dark:text-gray-100 mt-1 whitespace-pre-wrap break-words">{event.location}</div>
            </div>
          </>}

          {(event.reminderMinutesBefore !== undefined || event.alarmEnabled) && (
            <>
              <div className="h-px bg-gray-100 dark:bg-white/10 mx-5" />
              <div className="px-5 py-4">
                <div className="text-[13px] text-app-text-muted dark:text-gray-400">{s.label_reminder}</div>
                <div className="text-[15px] text-app-text dark:text-gray-100 mt-1 break-words">
                  {formatReminderLabel(event.reminderMinutesBefore) || s.label_at_start}
                  {event.alarmEnabled ? s.detail_alarm_suffix : ''}
                </div>
              </div>
            </>
          )}

          {event.description && (
            <>
              <div className="h-px bg-gray-100 dark:bg-white/10 mx-5" />
              <div className="px-5 py-4">
                <div className="text-[13px] text-app-text-muted dark:text-gray-400">{s.detail_notes_label}</div>
                <div className="text-[15px] text-app-text dark:text-gray-100 mt-1 whitespace-pre-wrap break-words">
                  {event.description}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Floating buttons */}
      <div className="absolute left-0 right-0 bottom-0 pb-safe pointer-events-none">
        <div className="calendar-event-detail-actions flex justify-center gap-4 px-6 pb-6">
          <button
            {...bindTap('event.edit', { params: { eventId: event.id } })}
            className="pointer-events-auto w-14 h-14 rounded-full bg-white/95 dark:bg-[#1c1c1e]/95 shadow-lg flex items-center justify-center text-gray-800 dark:text-gray-100 active:scale-95 transition-transform"
            aria-label={s.edit_event}
          >
            <MaskIcon src={calIcon('miuix_action_icon_edit_light')} size={22} />
          </button>
          <button
            {...bindTap('event.delete.open', { params: { eventId: event.id } })}
            className="pointer-events-auto w-14 h-14 rounded-full bg-white/95 dark:bg-[#1c1c1e]/95 shadow-lg flex items-center justify-center text-red-600 active:scale-95 transition-transform"
            aria-label={s.delete_action}
          >
            <MaskIcon src={calIcon('miuix_action_icon_delete_light')} size={22} />
          </button>
        </div>
      </div>

      </div>
      {showDeleteConfirm && <CalendarDeleteDialog eventId={event.id} />}
    </div>
  );
};
