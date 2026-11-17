import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IcNavForward } from '../res/icons';
import { useCalendarStore } from '../state';
import { useShallow } from 'zustand/react/shallow';
import { Toast } from '@/os/components/Toast';
import { MaskIcon } from '../components/MaskIcon';
import { CalendarActionSheet } from '../components/CalendarActionSheet';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useCalendarGestures } from '../hooks/useCalendarGestures';
const calIcon = (name: string) => name ? `/@app-assets/Calendar/icons/${name}.svg` : '';

/* ---- Local simple components (no SettingsContext dependency) ---- */
const Section: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="mb-3">
        {title && <div className="px-4 pt-4 pb-1.5 text-[13px] text-app-text-muted">{title}</div>}
        <div className="bg-app-surface dark:bg-[#2c2c2e] rounded-2xl overflow-hidden mx-4">
            {children}
        </div>
    </div>
);

const Item: React.FC<{ title: string; value?: string; onClick?: () => void; tapProps?: React.ButtonHTMLAttributes<HTMLButtonElement>; showDivider?: boolean }> = ({ title, value, onClick, tapProps, showDivider = true }) => (
    <div>
        <button type="button" className="w-full text-left flex items-center px-4 py-3.5 min-h-[52px]" onClick={onClick} {...tapProps}>
            <span className="flex-1 text-[15px] text-app-text dark:text-gray-100">{title}</span>
            <div className="flex items-center gap-1 shrink-0">
                {value && <span className="text-[13px] text-gray-400">{value}</span>}
                <IcNavForward size={16} className="text-gray-300" />
            </div>
        </button>
        {showDivider && <div className="h-px bg-gray-100 dark:bg-gray-800 mx-4" />}
    </div>
);

const SwitchItem: React.FC<{ title: string; checked: boolean; onChange: (v: boolean) => void; showDivider?: boolean }> = ({ title, checked, onChange, showDivider = true }) => {
    return (
        <div>
            <div className="flex items-center px-4 py-3.5 min-h-[52px]" onClick={() => onChange(!checked)}>
                <span className="flex-1 text-[15px] text-app-text dark:text-gray-100">{title}</span>
                <div
                    className={`w-[44px] h-[26px] rounded-full flex items-center p-[2px] shrink-0
                        ${checked ? 'bg-[#3482FF] justify-end' : 'bg-gray-300 dark:bg-gray-600 justify-start'}`}
                    style={{ transition: 'background-color var(--app-duration-short) var(--app-easing-standard)' }}
                >
                    <div className="w-[22px] h-[22px] bg-app-surface rounded-full shadow-sm" />
                </div>
            </div>
            {showDivider && <div className="h-px bg-gray-100 dark:bg-gray-800 mx-4" />}
        </div>
    );
};

/* ---- Page ---- */

const CalendarSettingsPage: React.FC = () => {
    const { bindBack, bindTap, back } = useCalendarGestures();
    const { settings, updateSettings } = useCalendarStore(useShallow(s => ({ settings: s.settings, updateSettings: s.updateSettings })));
    const s = useAppStrings(strings, stringsEn);
    const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
    const sheetReturnFocus = React.useRef<HTMLElement | null>(null);
    const [searchParams] = useSearchParams();
    const sheet = searchParams.get('sheet');
    const sheetOpen = sheet === 'reminder' || sheet === 'allday' || sheet === 'later';
    const submitted = React.useRef(false);
    React.useEffect(() => { submitted.current = false; }, [sheet]);
    const submit = (patch: Parameters<typeof updateSettings>[0]) => {
        if (submitted.current) return;
        submitted.current = true;
        updateSettings(patch);
        back();
    };

    const showToast = (message: string) => {
        setToast({ visible: true, message });
        window.setTimeout(() => setToast({ visible: false, message: '' }), 1200);
    };

    const weekStartLabel = settings.weekStartDay === 'sunday' ? s.week_start_sunday : s.week_start_monday;
    const defaultReminderLabel =
        settings.defaultReminder === '0_minutes_before'
            ? s.label_at_start
            : settings.defaultReminder === '5_minutes_before'
              ? s.settings_reminder_val_5_min
              : settings.defaultReminder === '15_minutes_before'
                ? s.settings_reminder_val_15_min
                : settings.defaultReminder === '30_minutes_before'
                  ? s.settings_reminder_val_30_min
                  : settings.defaultReminder === '60_minutes_before'
                    ? s.settings_reminder_val_1_hour
                    : settings.defaultReminder === '1_day_before'
                      ? s.settings_reminder_val_1_day
                      : s.settings_reminder_val_15_min;
    const defaultAllDayReminderLabel =
        settings.defaultAllDayReminder === 'start_of_day'
            ? s.settings_allday_0
            : settings.defaultAllDayReminder === '9_am_on_day'
              ? s.settings_allday_9
              : settings.defaultAllDayReminder === '9_am_day_before'
                ? s.settings_allday_prev_9
                : s.settings_allday_9;
    const defaultLaterReminderLabel =
        settings.defaultReminderLaterTime === '5_minutes'
            ? s.settings_later_5_min
            : settings.defaultReminderLaterTime === '10_minutes'
              ? s.settings_later_10_min
              : settings.defaultReminderLaterTime === '30_minutes'
                ? s.settings_later_30_min
                : settings.defaultReminderLaterTime === '60_minutes'
                  ? s.settings_later_1_hour
                  : s.settings_later_10_min;

    return (
        <div data-calendar-sheet-host className="calendar-settings-page relative flex flex-col h-full bg-app-bg dark:bg-[#111] text-black dark:text-white pt-10">
            <Toast message={toast.message} visible={toast.visible} />
            <div inert={sheetOpen || undefined} style={{ display: 'contents' }}>
            {/* Header */}
            <div className="flex items-center px-4 py-3 bg-app-surface dark:bg-[#1c1c1e] border-b border-app-border dark:border-white/10 shrink-0">
                <button
                    {...bindBack()}
                    className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
                >
                    <span className="text-gray-700 dark:text-gray-200">
                        <MaskIcon src={calIcon('miuix_action_icon_back_light')} size={22} />
                    </span>
                </button>
                <h1 className="ml-2 text-xl font-medium">{s.settings}</h1>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pb-8" data-scroll-container="main" data-scroll-direction="vertical">
                <Section>
                    <Item title={s.settings_import} onClick={() => showToast('暂未实现：日程导入')} />
                    <Item title={s.settings_account_manage} onClick={() => showToast('暂未实现：日程账号管理')} showDivider={false} />
                </Section>

                <Section title={s.settings_section_calendar}>
                    <Item
                        title={s.settings_week_start}
                        value={weekStartLabel}
                        onClick={() =>
                            updateSettings({
                                weekStartDay: settings.weekStartDay === 'sunday' ? 'monday' : 'sunday',
                            })
                        }
                    />
                    <SwitchItem
                        title={s.settings_show_extend_month}
                        checked={settings.showExtendMonth}
                        onChange={(v) => updateSettings({ showExtendMonth: v })}
                    />
                    <SwitchItem
                        title={s.settings_show_week_number}
                        checked={settings.showWeekNumber}
                        onChange={(v) => updateSettings({ showWeekNumber: v })}
                        showDivider={false}
                    />
                </Section>

                <Section title={s.settings_section_features}>
                    <Item title={s.settings_horoscope} onClick={() => showToast('暂未实现：星座运势')} />
                    <SwitchItem
                        title={s.settings_almanac}
                        checked={settings.showAlmanacYiJi}
                        onChange={(v) => updateSettings({ showAlmanacYiJi: v })}
                    />
                    <Item title={s.settings_global_holidays} onClick={() => showToast('暂未实现：全球节日')} />
                    <Item title={s.settings_other_calendars} onClick={() => showToast('暂未实现：其他历法')} />
                    <SwitchItem
                        title={s.settings_smart_extract}
                        checked={settings.autoInsertAiEvent}
                        onChange={(v) => updateSettings({ autoInsertAiEvent: v })}
                        showDivider={false}
                    />
                </Section>

                <Section title={s.settings_section_reminder}>
                    <Item title={s.settings_reminder} onClick={() => showToast('暂未实现：日程提醒设置')} />
                    <Item title={s.settings_default_reminder} value={defaultReminderLabel} tapProps={bindTap('settings.reminder.open', { beforeTrigger: event => { sheetReturnFocus.current = event.currentTarget; } })} />
                    <Item title={s.settings_default_allday_reminder} value={defaultAllDayReminderLabel} tapProps={bindTap('settings.allday.open', { beforeTrigger: event => { sheetReturnFocus.current = event.currentTarget; } })} />
                    <Item title={s.settings_default_later_reminder} value={defaultLaterReminderLabel} tapProps={bindTap('settings.later.open', { beforeTrigger: event => { sheetReturnFocus.current = event.currentTarget; } })} />
                    <SwitchItem
                        title={s.settings_holiday_reminder}
                        checked={settings.holidayReminder}
                        onChange={(v) => updateSettings({ holidayReminder: v })}
                        showDivider={false}
                    />
                </Section>

                <Section title={s.settings_section_other}>
                    <SwitchItem
                        title={s.settings_show_rejected}
                        checked={settings.showRejectAgenda}
                        onChange={(v) => updateSettings({ showRejectAgenda: v })}
                    />
                    <SwitchItem
                        title={s.settings_auto_import_birthday}
                        checked={settings.autoImportBirthday}
                        onChange={(v) => updateSettings({ autoImportBirthday: v })}
                    />
                    <Item title={s.settings_holiday_data} onClick={() => showToast('暂未实现：节假日数据更新')} />
                    <Item title={s.settings_timezone} onClick={() => showToast('暂未实现：日程时区设置')} />
                    <Item title={s.settings_ux_plan} onClick={() => showToast('暂未实现：用户体验计划')} />
                    <Item title={s.settings_privacy} onClick={() => showToast('暂未实现：隐私与权限')} />
                    <Item title={s.settings_about} onClick={() => showToast('暂未实现：关于日历')} showDivider={false} />
                </Section>
            </div>
            </div>
            {sheet === 'reminder' && <CalendarActionSheet returnFocus={sheetReturnFocus.current} title={s.settings_default_reminder} items={[
                ['0_minutes_before', s.label_at_start], ['5_minutes_before', s.settings_reminder_val_5_min],
                ['15_minutes_before', s.settings_reminder_val_15_min], ['30_minutes_before', s.settings_reminder_val_30_min],
                ['60_minutes_before', s.settings_reminder_val_1_hour], ['1_day_before', s.settings_reminder_val_1_day],
            ].map(([value, title]) => ({ id: value, title, selected: settings.defaultReminder === value,
                tapProps: bindTap({ kind: 'action', id: 'calendar.settings.reminder.submit' }, {
                    params: { value }, onTrigger: () => submit({ defaultReminder: value }),
                }),
            }))} />}
            {sheet === 'allday' && <CalendarActionSheet returnFocus={sheetReturnFocus.current} title={s.settings_default_allday_reminder} items={[
                ['start_of_day', s.settings_allday_0], ['9_am_on_day', s.settings_allday_9], ['9_am_day_before', s.settings_allday_prev_9],
            ].map(([value, title]) => ({ id: value, title, selected: settings.defaultAllDayReminder === value,
                tapProps: bindTap({ kind: 'action', id: 'calendar.settings.allday.submit' }, {
                    params: { value }, onTrigger: () => submit({ defaultAllDayReminder: value }),
                }),
            }))} />}
            {sheet === 'later' && <CalendarActionSheet returnFocus={sheetReturnFocus.current} title={s.settings_default_later_reminder} items={[
                ['5_minutes', s.settings_later_5_min], ['10_minutes', s.settings_later_10_min],
                ['30_minutes', s.settings_later_30_min], ['60_minutes', s.settings_later_1_hour],
            ].map(([value, title]) => ({ id: value, title, selected: settings.defaultReminderLaterTime === value,
                tapProps: bindTap({ kind: 'action', id: 'calendar.settings.later.submit' }, {
                    params: { value }, onTrigger: () => submit({ defaultReminderLaterTime: value }),
                }),
            }))} />}
        </div>
    );
};

export default CalendarSettingsPage;
