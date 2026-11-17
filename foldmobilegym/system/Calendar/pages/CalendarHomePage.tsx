import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarGrid } from '../components/CalendarGrid';
import { CalendarBottomNav, CalendarViewType } from '../components/CalendarBottomNav';
import { CalendarMonthAgenda } from '../components/CalendarMonthAgenda';
import { CalendarAgendaMaster } from '../components/CalendarAgendaMaster';
import { CalendarSectionNav } from '../components/CalendarSectionNav';
import { calendarMonthEventTime } from '../monthAgenda';
import { CalendarYearView } from '../components/CalendarYearView';
import { CalendarWeekView } from '../components/CalendarWeekView';
import { CalendarDayView } from '../components/CalendarDayView';
import { buildEventDateKeySet, generateMonthDays, getLunarFullInfo, getLunarInfo } from '../utils/calendarUtils';
const calIcon = (name: string) => name ? `/@app-assets/Calendar/icons/${name}.svg` : '';
import { MaskIcon } from '../components/MaskIcon';
import { CalendarActionSheet } from '../components/CalendarActionSheet';
import { useCalendarStore, selectSelectedDate } from '../state';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useCalendarGestures } from '../hooks/useCalendarGestures';
import { useCalendarSurfaceAction } from '../hooks/useCalendarSurfaceAction';
import { useCalendarMonthSwipe } from '../hooks/useCalendarMonthSwipe';
import { shiftMonthTimestamp } from '../monthNavigation';
import * as TimeService from '@/os/TimeService';
import { getSystemSymbolUrl, IcSymbolImport, IcSymbolMonths, IcSymbolTheme, IcSymbolTune } from '../res/icons';

const WEEK_LABELS_MON = ['一', '二', '三', '四', '五', '六', '日'];
const WEEK_LABELS_SUN = ['日', '一', '二', '三', '四', '五', '六'];

const formatHHmm = (ts: number) => {
    const d = TimeService.fromTimestamp(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const CalendarHomePage: React.FC = () => {
    const { go, bindTap } = useCalendarGestures();
    const runSurfaceAction = useCalendarSurfaceAction();
    const selectedDate = useCalendarStore(selectSelectedDate);
    const setSelectedDate = useCalendarStore(s => s.setSelectedDate);
    const settings = useCalendarStore(s => s.settings);
    const calendarEvents = useCalendarStore(s => s.events);
    const s = useAppStrings(strings, stringsEn);

    const [searchParams] = useSearchParams();
    const view = searchParams.get('view');
    const activeView: CalendarViewType = view === 'year' || view === 'week' || view === 'day' || view === 'agenda' ? view : 'month';
    const menuOpen = searchParams.get('menu') === 'open';
    const sheetReturnFocus = React.useRef<HTMLElement | null>(null);

    const viewYear = selectedDate.getFullYear();
    const viewMonth = selectedDate.getMonth();
    const weekStartDay = settings.weekStartDay === 'sunday' ? 'sunday' : 'monday';

    const days = React.useMemo(
        () => generateMonthDays(viewYear, viewMonth, weekStartDay),
        [viewYear, viewMonth, weekStartDay],
    );
    const eventDateKeys = React.useMemo(() => buildEventDateKeySet(calendarEvents), [calendarEvents]);

    const lunarFull = getLunarFullInfo(selectedDate);
    const lunarCell = getLunarInfo(selectedDate);

    const dayEvents = React.useMemo(() => {
        const dayStart = TimeService.fromTimestamp(selectedDate.getTime()); dayStart.setHours(0, 0, 0, 0);
        const dayStartTs = dayStart.getTime();
        const dayEndTs = dayStartTs + 24 * 60 * 60 * 1000;
        return calendarEvents
            .filter(e => e.startTs < dayEndTs && e.endTs > dayStartTs)
            .sort((a, b) => a.startTs - b.startTs);
    }, [calendarEvents, selectedDate]);

    const shareCalendarDay = () => {
        const date = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
        const summary = dayEvents.length
            ? dayEvents.map(event => `${formatHHmm(event.startTs)} ${event.title}`).join('\n')
            : s.empty_agenda;
        window.__OS__?.startActivity({ action: 'ACTION_SEND', type: 'text/plain', data: { text: `${date}\n${summary}` } });
    };

    const agendaItems = React.useMemo(() => {
        const items: Array<{
            id?: string;
            title: string;
            subtitle: string;
            daysLeft?: string;
            isHoliday?: boolean;
            color?: string;
            timeLabel?: string;
            timeValue?: string;
            onClick?: () => void;
            tapProps?: React.HTMLAttributes<HTMLButtonElement>;
        }> = [];

        // Festival / solar term / holiday highlight
        if ((lunarCell.isFestival || lunarCell.isSolarTerm || lunarCell.isHoliday) && lunarCell.isSpecial) {
            items.push({
                id: 'special',
                title: lunarCell.label,
                subtitle: lunarFull.title,
                isHoliday: lunarCell.isHoliday,
            });
        }

        for (const e of dayEvents) {
            const times = calendarMonthEventTime(e, selectedDate.getTime(), { allDay:s.label_all_day_value, starts:s.workspace_starts, ends:s.workspace_ends, continues:s.week_continues });
            items.push({
                id: e.id,
                title: e.title,
                color: e.color,
                ...times,
                subtitle: e.allDay ? s.label_all_day_value : formatHHmm(e.startTs),
                tapProps: bindTap('event.open', { params: { eventId: e.id } }),
            });
        }

        if (items.length === 0) {
            items.push({
                id: 'empty',
                title: s.empty_agenda,
                subtitle: s.empty_agenda_hint,
                tapProps: bindTap('new-event.open', { onTrigger: () => runSurfaceAction(() => go('new-event.open')) }),
            });
        }

        return items;
    }, [dayEvents, bindTap, go, runSurfaceAction, lunarCell.isFestival, lunarCell.isHoliday, lunarCell.isSolarTerm, lunarCell.isSpecial, lunarCell.label, lunarFull.title, s.empty_agenda, s.empty_agenda_hint, s.label_all_day_value, selectedDate, s.workspace_ends, s.workspace_starts, s.week_continues]);

    const weekLabels = weekStartDay === 'sunday' ? WEEK_LABELS_SUN : WEEK_LABELS_MON;

    const monthSwipe = useCalendarMonthSwipe(
        delta => setSelectedDate(TimeService.fromTimestamp(shiftMonthTimestamp(selectedDate.getTime(), delta))),
        `${activeView}:${selectedDate.getTime()}:${menuOpen}`,
    );

    const renderTitle = () => {
        if (activeView === 'year') return `${viewYear}`;
        if (activeView === 'day') return s.home_month_day.replace('{{month}}', String(viewMonth + 1)).replace('{{day}}', String(selectedDate.getDate()));
        return s.home_year_month.replace('{{year}}', String(viewYear)).replace('{{month}}', String(viewMonth + 1));
    };

    const renderContent = () => {
        switch (activeView) {
            case 'year':
                return (
                    <CalendarYearView
                        year={viewYear}
                        selectedDate={selectedDate}
                        weekStartDay={weekStartDay}
                        monthTapProps={monthIndex => bindTap('home.view.switch', {
                            params: { view: 'month', month: monthIndex },
                            beforeTrigger: () => {
                                const d = TimeService.fromTimestamp(selectedDate.getTime());
                                d.setMonth(monthIndex, 1);
                                setSelectedDate(d);
                            },
                        })}
                    />
                );

            case 'week':
                return (
                    <CalendarWeekView
                        currentDate={selectedDate}
                        events={calendarEvents}
                        dayTapProps={date => bindTap({ kind: 'action', id: 'calendar.week.date.input' }, {
                            params: { value: date.getTime() }, onTrigger: () => setSelectedDate(date),
                        })}
                        eventTapProps={(event, dateKey) => bindTap('event.open', { params: { eventId: event.id, date: dateKey } })}
                        weekStartDay={weekStartDay}
                    />
                );

            case 'agenda':
                return <div className="calendar-home-agenda"><CalendarAgendaMaster home /></div>;

            case 'day':
                return <CalendarDayView date={selectedDate} agendaItems={agendaItems} />;

            case 'month':
            default:
                return (
                    <div className="calendar-month-layout flex flex-col h-full"
                        data-scroll-container="monthContent" data-scroll-direction="vertical">
                        {/* 月视图：左右滑动切换月份（左滑下一月，右滑上一月） */}
                        <div
                            className="calendar-month-grid-pane shrink-0 select-none"
                            data-scroll-container="monthGrid" data-scroll-direction="vertical"
                            style={{ touchAction: 'pan-y' }}
                            {...monthSwipe}
                        >
                            {/* Weekday labels row */}
                            <div
                                className="grid px-3 py-2"
                                style={{ gridTemplateColumns: settings.showWeekNumber ? '28px repeat(7, 1fr)' : 'repeat(7, 1fr)' }}
                            >
                                {settings.showWeekNumber && <div />}
                                {weekLabels.map((w) => (
                                    <div key={w} className="text-center text-sm text-app-text-muted">{w}</div>
                                ))}
                            </div>

                            {/* Date grid */}
                            <div className="shrink-0 px-1">
                                <CalendarGrid
                                    days={days}
                                    selectedDate={selectedDate}
                                    onDayClick={(day) => setSelectedDate(day.date)}
                                    showExtendMonth={settings.showExtendMonth}
                                    showWeekNumber={settings.showWeekNumber}
                                    eventDateKeys={eventDateKeys}
                                />
                            </div>
                        </div>

                        {/* Agenda bottom sheet */}
                        <CalendarMonthAgenda
                            date={selectedDate}
                            lunarTitle={lunarFull.title}
                            items={agendaItems}
                        />
                    </div>
                );
        }
    };

    return (
        <div data-calendar-sheet-host data-calendar-view={activeView} className="calendar-home-reference relative flex flex-col h-full bg-app-surface dark:bg-black overflow-hidden">
            <div inert={menuOpen || undefined} style={{ display: 'contents' }}>

            {/* ========== Shared top header ========== */}
            <div className="calendar-home-header flex items-center justify-between px-5 pt-10 pb-2 bg-app-surface dark:bg-black shrink-0">
                {/* Left */}
                <button
                    className="flex flex-col items-start"
                    {...bindTap('home.view.switch', { params: { view: activeView === 'year' ? 'month' : 'year' } })}
                >
                    <div className="calendar-reference-title text-3xl font-light text-black dark:text-white">{renderTitle()}</div>
                    <div className="calendar-home-lunar-subtitle text-[11px] text-gray-400 mt-0.5">
                        {lunarFull.title} · {lunarFull.subtitle}
                    </div>
                </button>

                {/* Right actions */}
                <div className="flex items-center gap-4 text-gray-700 dark:text-gray-200">
                    <button
                        {...bindTap('search.open')}
                        className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5 dark:active:bg-white/5"
                        aria-label={s.search}
                    >
                        <MaskIcon src={calIcon('miuix_action_icon_search_light')} size={22} />
                    </button>
                    <button
                        {...bindTap('new-event.open', { onTrigger: () => runSurfaceAction(() => go('new-event.open')) })}
                        className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5 dark:active:bg-white/5"
                        aria-label={s.action_new}
                        data-calendar-add
                    >
                        <MaskIcon src={calIcon('action_bar_new_event_desk_view')} size={22} />
                    </button>
                    <button
                        {...bindTap('home.menu.open', { beforeTrigger: event => { sheetReturnFocus.current = event.currentTarget; } })}
                        className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5 dark:active:bg-white/5"
                        aria-label={s.action_more}
                    >
                        <MaskIcon src={calIcon('miuix_action_icon_immersion_more_dark')} size={22} />
                    </button>
                </div>
            </div>

            <CalendarBottomNav
                activeView={activeView}
                includeAgenda
                dayNumber={selectedDate.getDate()}
            />

            <div className="flex-1 min-h-0 overflow-hidden">
                {renderContent()}
            </div>
            </div>

            <div inert={menuOpen || undefined}><CalendarSectionNav selected="calendar" /></div>

            {menuOpen && <CalendarActionSheet returnFocus={sheetReturnFocus.current}
                title={s.action_more}
                items={[
                    {
                        id: 'date-jump',
                        title: s.action_date_jump,
                        icon: <MaskIcon src={getSystemSymbolUrl(IcSymbolMonths, '2')} size={20} />,
                        tapProps: bindTap('date-jump.open'),
                    },
                    {
                        id: 'date-calculate',
                        title: s.action_date_calculate,
                        icon: <MaskIcon src={getSystemSymbolUrl(IcSymbolTune, '2')} size={20} />,
                        tapProps: bindTap('date-calculate.open'),
                    },
                    {
                        id: 'subscription',
                        title: s.action_subscription,
                        icon: <MaskIcon src={getSystemSymbolUrl(IcSymbolImport, '2')} size={20} />,
                        tapProps: bindTap('subscription.open'),
                    },
                    {
                        id: 'desk-theme',
                        title: s.action_desk_theme,
                        icon: <MaskIcon src={getSystemSymbolUrl(IcSymbolTheme, '2')} size={20} />,
                        tapProps: bindTap('desk-theme.open'),
                    },
                    {
                        id: 'share',
                        title: s.action_share,
                        icon: <MaskIcon src={calIcon('miuix_action_icon_share_light')} size={20} />,
                        tapProps: bindTap({ kind: 'action', id: 'calendar.home.share' }, { onTrigger: shareCalendarDay }),
                    },
                    {
                        id: 'settings',
                        title: s.action_settings,
                        icon: <MaskIcon src={calIcon('miuix_action_icon_settings_light')} size={20} />,
                        tapProps: bindTap('settings.open'),
                    },
                ]}
            />}

        </div>
    );
};

export default CalendarHomePage;
