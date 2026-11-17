import { useCalendarEventId } from '../hooks/useCalendarEventId';
import React, { useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { UNSAFE_NavigationContext, useLocation, useSearchParams } from 'react-router-dom';
import { IcNavForward, IcCalendarDays, IcCake, IcBookmark, IcTimer } from '../res/icons';
import { MaskIcon } from '../components/MaskIcon';
import { Toast } from '@/os/components/Toast';
import { CalendarReminderSheet } from '../components/CalendarReminderSheet';
import { CalendarEventTypeSheet } from '../components/CalendarEventTypeSheet';
import { CalendarDiscardPrompt } from '../components/CalendarDiscardPrompt';
import { useCalendarStore, selectSelectedDate } from '../state';
import { useShallow } from 'zustand/react/shallow';
import type { CalendarEventType } from '../types';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useCalendarGestures } from '../hooks/useCalendarGestures';
import * as TimeService from '@/os/TimeService';
import { getTracker } from '@/os/utils/memoryHistoryTracker';
import { dateInputValue, replaceCalendarDate } from '../dateEditing';
import { calendarTimeTextAfterSync, replaceCalendarTime, resolveCalendarSaveTime } from '../timeEditing';
import { moveCalendarAllDayStart, toCalendarAllDayRange } from '../eventRange';
import { useCalendarEventOwner } from '../hooks/useCalendarEventOwner';
import { BackDispatcher } from '@/os/BackDispatcher';
const calIcon = (name: string) => name ? `/@app-assets/Calendar/icons/${name}.svg` : '';

export const CalendarNewEventPage: React.FC = () => {
    const eventId = useCalendarEventId();
    const events = useCalendarStore(s => s.events);
    const s = useAppStrings(strings, stringsEn);
    const { bindBack } = useCalendarGestures();
    const editingRoute = useLocation().pathname !== '/new-event';
    // An edit route owns an existing identity. Do not mount an editor (and its
    // draft-persistence effects) if the referenced event is absent or removed.
    if (editingRoute && (!eventId || !events.some(event => event.id === eventId))) {
        return (
            <div className="calendar-editor-missing-event flex flex-col h-full bg-app-surface dark:bg-black text-black dark:text-white pt-10">
                <div className="flex items-center px-4 py-3 shrink-0">
                    <button {...bindBack()} className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5 dark:active:bg-white/5 text-gray-700 dark:text-gray-200">
                        <MaskIcon src={calIcon('miuix_action_icon_back_light')} size={22} />
                    </button>
                    <h1 className="ml-2 text-[17px] font-medium">{s.edit_event}</h1>
                </div>
                <div className="flex-1 flex items-center justify-center text-sm text-gray-400">{s.event_not_found}</div>
            </div>
        );
    }
    return <CalendarEventEditor key={eventId ?? 'new'} />;
};

const CalendarEventEditor: React.FC = () => {
    const { back, go, bindBack, bindTap } = useCalendarGestures();
    const [searchParams] = useSearchParams();
    const { navigator } = useContext(UNSAFE_NavigationContext);
    const eventId = useCalendarEventId();
    const selectedDate = useCalendarStore(selectSelectedDate);
    const { settings, createEvent, setSelectedDate, updateEvent, events, draft, updateDraft, clearDraft } = useCalendarStore(
      useShallow(s => ({
        settings: s.settings,
        createEvent: s.createEvent,
        setSelectedDate: s.setSelectedDate,
        updateEvent: s.updateEvent,
        events: s.events,
        draft: s.draft,
        updateDraft: s.updateDraft,
        clearDraft: s.clearDraft,
      })),
    );
    const s = useAppStrings(strings, stringsEn);

    const TAB_CONFIG: { key: CalendarEventType; label: string; icon: React.ReactNode }[] = [
        { key: 'event', label: s.event_type_normal, icon: <IcCalendarDays size={20} /> },
        { key: 'birthday', label: s.event_type_birthday, icon: <IcCake size={20} /> },
        { key: 'anniversary', label: s.event_type_anniversary, icon: <IcBookmark size={20} /> },
        { key: 'countdown', label: s.event_type_countdown, icon: <IcTimer size={20} /> },
    ];

    const existing = useMemo(() => (eventId ? events.find(e => e.id === eventId) : undefined), [eventId, events]);
    const editing = !!eventId && !!existing;
    const { sourceRef, sameSource, isCurrent } = useCalendarEventOwner(eventId);
    const editorRoot = useRef<HTMLDivElement>(null);
    const backHandlerId = useId();
    const publishedDraft = useRef<ReturnType<typeof useCalendarStore.getState>['draft'] | null>(null);
    useEffect(() => {
        if (eventId && !sameSource && useCalendarStore.getState().draft === publishedDraft.current) clearDraft();
    }, [eventId, sameSource, clearDraft]);
    useEffect(() => () => {
        if (eventId && useCalendarStore.getState().events.find(event => event.id === eventId) !== sourceRef.current
            && useCalendarStore.getState().draft === publishedDraft.current) clearDraft();
    }, [eventId, sourceRef, clearDraft]);


    const restored = (draft.eventId ?? null) === (eventId ?? null) ? draft : undefined;
    const defaultReminder = ({ '0_minutes_before': 0, '5_minutes_before': 5,
        '15_minutes_before': 15, '30_minutes_before': 30, '60_minutes_before': 60,
        '1_day_before': 1440 } as Record<string, number>)[settings.defaultReminder] ?? 0;
    const [eventType, setEventType] = useState<CalendarEventType>(() => restored?.eventType ?? existing?.type ?? 'event');
    const [title, setTitle] = useState(() => restored?.title ?? existing?.title ?? '');
    const [notes, setNotes] = useState(() => restored?.notes ?? existing?.description ?? '');
    const [location, setLocation] = useState(() => restored?.location ?? existing?.location ?? '');
    const [isAllDay, setIsAllDay] = useState(() => restored?.allDay ?? existing?.allDay ?? false);
    const [isAlarm, setIsAlarm] = useState(() => restored?.alarmEnabled ?? existing?.alarmEnabled ?? false);
    const [reminderMinutesBefore, setReminderMinutesBefore] = useState<number | null>(() =>
        restored?.reminderMinutesBefore !== undefined ? restored.reminderMinutesBefore :
            existing ? existing.reminderMinutesBefore ?? null : defaultReminder);
    const saved = useRef(false);
    const reminderSheetOpen = searchParams.get('sheet') === 'reminder';
    const typeSheetOpen = searchParams.get('sheet') === 'type';
    const discardSheetOpen = searchParams.get('sheet') === 'discard';
    const modalOpen = reminderSheetOpen || typeSheetOpen || discardSheetOpen;
    const [moreSettings, setMoreSettings] = useState(() => editing || Boolean(restored && (
        restored.location || restored.notes || restored.allDay || restored.alarmEnabled
        || (restored.eventType && restored.eventType !== 'event')
        || (restored.reminderMinutesBefore !== undefined && restored.reminderMinutesBefore !== defaultReminder)
    )));
    const [discarding, setDiscarding] = useState(false);
    const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });

    const showToast = (message: string) => {
        setToast({ visible: true, message });
        window.setTimeout(() => setToast({ visible: false, message: '' }), 1200);
    };

    const initialStart = restored?.startTs ?? existing?.startTs ?? selectedDate.getTime() + 30 * 60 * 1000;
    const initialEnd = restored?.endTs ?? existing?.endTs ?? selectedDate.getTime() + 90 * 60 * 1000;
    const timeText = (ts: number) => {
        const date = TimeService.fromTimestamp(ts);
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    };
    const dateText = (ts: number) => {
        const date = TimeService.fromTimestamp(ts);
        return s.editor_date_short.replace('{{month}}', String(date.getMonth() + 1)).replace('{{day}}', String(date.getDate()));
    };
    const [startTs, setStartTs] = useState(initialStart);
    const [endTs, setEndTs] = useState(initialEnd);
    const [startTimeInput, setStartTimeInput] = useState(() => restored?.startTimeInput ?? timeText(initialStart));
    const [endTimeInput, setEndTimeInput] = useState(() => restored?.endTimeInput ?? timeText(initialEnd));
    const pristine = useRef({
        eventType: existing?.type ?? 'event' as CalendarEventType,
        title: existing?.title ?? '', notes: existing?.description ?? '', location: existing?.location ?? '',
        startTs: existing?.startTs ?? selectedDate.getTime() + 30 * 60 * 1000,
        endTs: existing?.endTs ?? selectedDate.getTime() + 90 * 60 * 1000,
        startTimeInput: timeText(existing?.startTs ?? selectedDate.getTime() + 30 * 60 * 1000),
        endTimeInput: timeText(existing?.endTs ?? selectedDate.getTime() + 90 * 60 * 1000),
        allDay: existing?.allDay ?? false,
        alarmEnabled: existing?.alarmEnabled ?? false,
        reminderMinutesBefore: existing ? existing.reminderMinutesBefore ?? null : defaultReminder,
    }).current;
    const dirty = eventType !== pristine.eventType || title !== pristine.title || notes !== pristine.notes
        || location !== pristine.location || startTs !== pristine.startTs || endTs !== pristine.endTs
        || startTimeInput !== pristine.startTimeInput || endTimeInput !== pristine.endTimeInput
        || isAllDay !== pristine.allDay || isAlarm !== pristine.alarmEnabled
        || reminderMinutesBefore !== pristine.reminderMinutesBefore;

    const syncTimeInputs = (st: number, et: number, preserveInvalid = false) => {
        setStartTimeInput(preserveInvalid ? calendarTimeTextAfterSync(startTimeInput, startTs, st) : timeText(st));
        setEndTimeInput(preserveInvalid ? calendarTimeTextAfterSync(endTimeInput, endTs, et, startTs) : timeText(et));
    };

    useEffect(() => {
        if (saved.current || !sameSource) return;
        updateDraft({ eventId: eventId ?? null, eventType, title, notes, location,
            startTs, endTs, startTimeInput, endTimeInput, allDay: isAllDay,
            alarmEnabled: isAlarm, reminderMinutesBefore });
        publishedDraft.current = useCalendarStore.getState().draft;
    }, [eventId, eventType, title, notes, location, startTs, endTs, startTimeInput,
        endTimeInput, isAllDay, isAlarm, reminderMinutesBefore, updateDraft, sameSource]);

    useEffect(() => {
        if (saved.current || modalOpen || !sameSource) return;
        return BackDispatcher.register(`calendar.editor.discard.${backHandlerId}`, () => {
            if (window.__OS__?.getState().activeAppId !== 'calendar' || saved.current || !isCurrent()) return false;
            if (!dirty) {
                clearDraft();
                return false;
            }
            if (eventId) go('discard.edit.open', { eventId });
            else go('discard.new.open');
            return true;
        }, 400);
    }, [backHandlerId, clearDraft, dirty, eventId, go, isCurrent, modalOpen, sameSource]);

    useEffect(() => {
        if (!discarding || discardSheetOpen) return;
        back();
    }, [back, discarding, discardSheetOpen]);

    // Only an explicit toggle converts timestamps. Mount/fold/keyboard edits must not shorten an existing span.
    const changeAllDay = (value: boolean) => {
        if (value && !isAllDay) {
            const range = toCalendarAllDayRange(startTs, endTs);
            setStartTs(range.startTs); setEndTs(range.endTs);
            syncTimeInputs(range.startTs, range.endTs);
        }
        setIsAllDay(value);
    };

    const applyStartDate = (value: string) => {
        const next = replaceCalendarDate(startTs, value);
        if (next === null) { showToast(s.validation_date_invalid); return; }
        const nextEnd = isAllDay ? moveCalendarAllDayStart(startTs, endTs, next).endTs : next + Math.max(0, endTs - startTs);
        setStartTs(next);
        setEndTs(nextEnd);
        syncTimeInputs(next, nextEnd, true);
    };
    const applyEndDate = (value: string) => {
        const next = replaceCalendarDate(endTs, value);
        if (next === null || next < startTs) { showToast(s.validation_date_invalid); return; }
        setEndTs(next);
        syncTimeInputs(startTs, next, true);
    };
    const startDateProps = {
        type: 'date', value: dateInputValue(startTs), 'aria-label': s.calculate_start_date,
        'data-benchmark-field': 'calendar-start-date', 'data-action-type': 'input',
        'data-action-params': JSON.stringify({ value: dateInputValue(startTs) }),
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => applyStartDate(event.target.value),
        className: 'w-[148px] max-w-full text-sm bg-transparent outline-none text-black dark:text-white',
    };
    const endDateProps = {
        type: 'date', value: dateInputValue(endTs), 'aria-label': s.calculate_end_date,
        'data-benchmark-field': 'calendar-end-date', 'data-action-type': 'input',
        'data-action-params': JSON.stringify({ value: dateInputValue(endTs) }),
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => applyEndDate(event.target.value),
        className: 'w-[148px] max-w-full text-sm bg-transparent outline-none text-black dark:text-white',
    };

    const applyStartTimeInput = () => {
        if (isAllDay) return;
        const newTs = replaceCalendarTime(startTs, startTimeInput);
        if (newTs === null) {
            showToast(s.toast_invalid_start_time);
            return;
        }
        const duration = Math.max(endTs - startTs, 0);
        const newEndTs = newTs + duration;
        setStartTs(newTs);
        setEndTs(newEndTs);
        syncTimeInputs(newTs, newEndTs, true);
    };

    const applyEndTimeInput = () => {
        if (isAllDay) return;
        const next = replaceCalendarTime(endTs, endTimeInput);
        if (next === null) {
            showToast(s.toast_invalid_end_time);
            return;
        }
        if (next < startTs) { showToast(s.validation_date_invalid); return; }
        setEndTs(next);
        syncTimeInputs(startTs, next, true);
    };

    const reminderLabel = useMemo(() => {
        if (reminderMinutesBefore === null) return s.remind_none;
        if (reminderMinutesBefore === 0) return s.label_at_start;
        if (reminderMinutesBefore === 10) return s.remind_10_min_before;
        if (reminderMinutesBefore === 60) return s.remind_1_hour_before;
        if (reminderMinutesBefore === 120) return s.remind_2_hour_before;
        if (reminderMinutesBefore === 24 * 60) return s.remind_1_day_before;
        if (reminderMinutesBefore === 2 * 24 * 60) return s.remind_2_day_before;
        return `${s.remind_before_prefix}${reminderMinutesBefore}${s.remind_before_suffix_min}`;
    }, [reminderMinutesBefore, s.remind_none, s.label_at_start, s.remind_10_min_before, s.remind_1_hour_before,
        s.remind_2_hour_before, s.remind_1_day_before, s.remind_2_day_before, s.remind_before_prefix, s.remind_before_suffix_min]);

    const handleSave = () => {
        if (saved.current || modalOpen || !isCurrent()) return;
        // Also guard a queued click against the live store, not a stale render.
        if (eventId && !useCalendarStore.getState().events.some(event => event.id === eventId)) {
            showToast(s.event_not_found);
            return;
        }
        const t = title.trim();
        if (!t) {
            showToast(s.validation_title_required);
            return;
        }
        const resolvedStart = isAllDay ? startTs : resolveCalendarSaveTime(startTs, startTimeInput);
        const resolvedEnd = isAllDay ? endTs : resolveCalendarSaveTime(endTs, endTimeInput);
        if (resolvedStart === null) { showToast(s.toast_invalid_start_time); return; }
        if (resolvedEnd === null) { showToast(s.toast_invalid_end_time); return; }
        if (resolvedEnd < resolvedStart) { showToast(s.validation_date_invalid); return; }
        if (!Number.isFinite(resolvedStart) || !Number.isFinite(resolvedEnd)) { showToast(s.validation_date_invalid); return; }
        if (isAllDay && resolvedEnd === resolvedStart) { showToast(s.validation_all_day_range); return; }
        const payload = {
            type: eventType,
            title: existing && title === existing.title ? existing.title : t,
            description: existing && notes === (existing.description ?? '') ? existing.description : notes.trim() || undefined,
            location: existing && location === (existing.location ?? '') ? existing.location : location.trim() || undefined,
            allDay: isAllDay,
            startTs: resolvedStart,
            endTs: resolvedEnd,
            reminderMinutesBefore: existing && reminderMinutesBefore === (existing.reminderMinutesBefore ?? null) ? existing.reminderMinutesBefore : reminderMinutesBefore,
            alarmEnabled: existing && isAlarm === (existing.alarmEnabled ?? false) ? existing.alarmEnabled : isAlarm,
        };

        saved.current = true;
        const active = document.activeElement as HTMLElement | null;
        if (active && editorRoot.current?.contains(active)) active.blur();
        const id = editing && eventId ? eventId : createEvent({ ...payload, calendarAccount: s.default_account });
        if (editing && eventId) updateEvent(eventId, payload);
        clearDraft();
        // Jump back to event day
        setSelectedDate(TimeService.fromTimestamp(resolvedStart));
        if (editing) {
            // Normal edit flow already has this detail in history. Return to it
            // instead of pushing another detail above the editor.
            const delta = getTracker(navigator as object)?.findPopToDelta(`/event/${encodeURIComponent(id)}`, false) ?? -1;
            if (delta > 0) back(delta);
            else go('event.open', { eventId: id }, { mode: 'replace' });
        } else back();
    };

    const handleDiscard = () => {
        if (saved.current || discarding || !isCurrent()) return;
        saved.current = true;
        clearDraft();
        setDiscarding(true);
        back();
    };

    const activeType = TAB_CONFIG.find(item => item.key === eventType) ?? TAB_CONFIG[0];
    const showQuickRows = editing || moreSettings || title.trim().length > 0;
    const showAdvanced = editing || moreSettings;
    const typeButton = <button type="button" className="calendar-editor-type-button" data-keep-keyboard="true"
        onPointerDown={event => event.preventDefault()}
        {...(eventId ? bindTap('type.edit.open', { params: { eventId } }) : bindTap('type.new.open'))}>
        <span className="calendar-editor-type-icon" aria-hidden="true">{activeType.icon}</span>
        <span>{activeType.label}</span>
        <span className="calendar-editor-spinner" aria-hidden="true">⌃⌄</span>
    </button>;

    const allDayRow = <Row label={s.label_all_day}>
        <Toggle value={isAllDay} onChange={changeAllDay} label={s.label_all_day}
          tapProps={eventId
            ? bindTap({ kind: 'action', id: 'calendar.edit.allDay.toggle' }, { params: { eventId, allDay: !isAllDay }, onTrigger: () => changeAllDay(!isAllDay) })
            : bindTap({ kind: 'action', id: 'calendar.new.allDay.toggle' }, { params: { allDay: !isAllDay }, onTrigger: () => changeAllDay(!isAllDay) })} />
    </Row>;

    return (
        <div ref={editorRoot} className="calendar-event-editor">
            <Toast message={toast.message} visible={toast.visible} />
            {reminderSheetOpen && <CalendarReminderSheet value={reminderMinutesBefore} onSelect={setReminderMinutesBefore} editing={!!eventId} />}
            {typeSheetOpen && <CalendarEventTypeSheet value={eventType} onSelect={setEventType} editing={!!eventId} />}
            {discardSheetOpen && <CalendarDiscardPrompt editing={editing} onDiscard={handleDiscard} />}
            <div inert={modalOpen || undefined} className="calendar-editor-owner" data-discard-open={discardSheetOpen || undefined}>
                <div className="calendar-editor-header">
                    <button {...bindBack()} className="calendar-editor-close" aria-label={s.close}>
                        <MaskIcon src={calIcon('miuix_action_icon_immersion_close_light')} size={22} />
                    </button>
                    <h1>{editing ? s.editor_edit_title : s.editor_create_title}</h1>
                    <button {...(eventId
                        ? bindTap({ kind: 'action', id: 'calendar.edit.save.submit' }, { params: { eventId }, onTrigger: handleSave })
                        : bindTap({ kind: 'action', id: 'calendar.new.save.submit' }, { onTrigger: handleSave }))}
                        data-keep-keyboard="true" disabled={!sameSource} aria-label={s.action_save} className="calendar-editor-save">
                        <MaskIcon src={calIcon('miuix_action_icon_immersion_done_light')} size={22} />
                    </button>
                </div>

                <div className="calendar-editor-body" data-scroll-container="main" data-scroll-direction="vertical">
                    {!sameSource && <p role="alert" data-calendar-source-changed className="calendar-editor-source-alert">{s.event_changed_reopen}</p>}

                    <section className="calendar-editor-card calendar-editor-title-card">
                        <textarea
                            rows={editing ? 3 : 4}
                            data-benchmark-field="calendar-title"
                            value={title}
                            onChange={(e) => { setTitle(e.target.value); updateDraft({ title: e.target.value }); }}
                            placeholder={s.label_title}
                        />
                        {editing
                            ? <div className="calendar-editor-type-row"><span>{s.label_type}</span>{typeButton}</div>
                            : <div className="calendar-editor-type-row calendar-editor-type-row-new">{typeButton}</div>}
                    </section>

                    <section className="calendar-editor-card calendar-editor-time-card">
                        {showAdvanced && allDayRow}
                        {!editing && title.trim() && <div className="calendar-editor-recognized-title"><i aria-hidden="true" />{title.trim()}</div>}
                        <div className="calendar-editor-time-grid">
                            <div className="calendar-editor-time-column">
                                <span>{s.label_start_time.replace('时间', '')}</span>
                                <input
                                    data-benchmark-field="calendar-start-time"
                                    value={isAllDay ? s.label_all_day_value : startTimeInput}
                                    onChange={(e) => setStartTimeInput(e.target.value)}
                                    onBlur={applyStartTimeInput}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') { applyStartTimeInput(); e.currentTarget.blur(); }
                                    }}
                                    disabled={isAllDay}
                                    inputMode="numeric"
                                    placeholder="09:00"
                                />
                                <label className="calendar-editor-date-control">
                                    <span>{dateText(startTs)}</span>
                                    {editing
                                        ? <input {...startDateProps} className="calendar-editor-date-input" data-action="calendar.edit.startDate.input" />
                                        : <input {...startDateProps} className="calendar-editor-date-input" data-action="calendar.new.startDate.input" />}
                                </label>
                            </div>
                            <span className="calendar-editor-time-separator" aria-hidden="true">〉</span>
                            <div className="calendar-editor-time-column">
                                <span>{s.label_end_time.replace('时间', '')}</span>
                                <input
                                    data-benchmark-field="calendar-end-time"
                                    value={isAllDay ? s.label_all_day_value : endTimeInput}
                                    onChange={(e) => setEndTimeInput(e.target.value)}
                                    onBlur={applyEndTimeInput}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') { applyEndTimeInput(); e.currentTarget.blur(); }
                                    }}
                                    disabled={isAllDay}
                                    inputMode="numeric"
                                    placeholder="10:00"
                                />
                                <label className="calendar-editor-date-control">
                                    <span>{dateText(endTs)}</span>
                                    {editing
                                        ? <input {...endDateProps} className="calendar-editor-date-input" data-action="calendar.edit.endDate.input" />
                                        : <input {...endDateProps} className="calendar-editor-date-input" data-action="calendar.new.endDate.input" />}
                                </label>
                            </div>
                        </div>

                        {isAllDay && <p className="calendar-editor-boundary" data-calendar-all-day-boundary>{s.detail_all_day_boundary}</p>}

                        {showAdvanced && <Row label={s.label_repeat}>
                            <span className="calendar-editor-row-value">{s.label_never}<IcNavForward size={17} /></span>
                        </Row>}

                        {showQuickRows && <>
                            <Row label={s.label_reminder}>
                                <button data-keep-keyboard="true" onPointerDown={event => event.preventDefault()}
                                  {...(eventId ? bindTap('reminder.edit.open', { params: { eventId } }) : bindTap('reminder.new.open'))}
                                  className="calendar-editor-row-value">
                                    <span>{reminderLabel}</span><IcNavForward size={17} />
                                </button>
                            </Row>
                            <Row label={s.label_alarm}>
                                <Toggle value={isAlarm} onChange={setIsAlarm} label={s.label_alarm} />
                            </Row>
                        </>}

                        {!editing && <button type="button" className="calendar-editor-more-settings" aria-expanded={moreSettings}
                          {...bindTap({ kind: 'action', id: 'calendar.new.moreSettings.toggle' }, {
                              params: { expanded: !moreSettings }, onTrigger: () => setMoreSettings(value => !value),
                          })}>
                            {moreSettings ? s.label_less_settings : s.label_more_settings}<span aria-hidden="true">⌄</span>
                        </button>}
                    </section>

                    {showAdvanced && <>
                        <section className="calendar-editor-card calendar-editor-account-card">
                            <Row label={s.label_calendar_account}>
                                <span data-calendar-editor-account className="calendar-editor-row-value">
                                    {existing?.calendarAccount ?? s.default_account}<IcNavForward size={17} />
                                </span>
                            </Row>
                        </section>
                        <section className="calendar-editor-card calendar-editor-text-card">
                            <input
                                type="text"
                                data-benchmark-field="calendar-location"
                                value={location}
                                onChange={(e) => { setLocation(e.target.value); updateDraft({ location: e.target.value }); }}
                                placeholder={s.label_location}
                            />
                        </section>
                        <section className="calendar-editor-card calendar-editor-text-card">
                            <textarea
                                rows={3}
                                data-benchmark-field="calendar-notes"
                                value={notes}
                                onChange={(e) => { setNotes(e.target.value); updateDraft({ notes: e.target.value }); }}
                                placeholder={s.label_notes}
                            />
                        </section>
                    </>}
                </div>
            </div>
        </div>
    );
};

/* ---- Helpers ---- */

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="calendar-editor-row">
        <span>{label}</span>
        {children}
    </div>
);

const Toggle: React.FC<{ value: boolean; onChange: (v: boolean) => void; label: string; tapProps?: React.ButtonHTMLAttributes<HTMLButtonElement> }> = ({ value, onChange, label, tapProps }) => (
    <button type="button" role="switch" aria-checked={value} aria-label={label}
        onClick={() => onChange(!value)}
        {...tapProps}
        className="calendar-editor-toggle"
        data-checked={value || undefined}
    >
        <span />
    </button>
);
