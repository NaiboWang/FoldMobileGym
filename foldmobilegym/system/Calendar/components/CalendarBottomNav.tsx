import React from 'react';
import { MaskIcon } from './MaskIcon';
import { getSystemSymbolUrl, getSystemDayIconName, IcSymbolMonths, IcSymbolWeeks, IcSymbolYears, IcAgenda } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useCalendarGestures } from '../hooks/useCalendarGestures';
export type CalendarViewType = 'year' | 'month' | 'week' | 'day' | 'agenda';

interface CalendarBottomNavProps {
    activeView?: CalendarViewType;
    tapProps?: (view: CalendarViewType) => React.ButtonHTMLAttributes<HTMLButtonElement>;
    dayNumber: number;
    includeAgenda?: boolean;
}

const CACHE_V = '2';

export const CalendarBottomNav: React.FC<CalendarBottomNavProps> = ({ activeView, dayNumber, tapProps, includeAgenda = false }) => {
    const { bindTap } = useCalendarGestures();
    const s = useAppStrings(strings, stringsEn);
    const dayIconName = getSystemDayIconName(dayNumber);

    const items: { id: CalendarViewType; label: string; icon: React.ReactNode }[] = [
        {
            id: 'year',
            label: s.tab_year,
            icon: <MaskIcon src={getSystemSymbolUrl(IcSymbolYears, CACHE_V)} size={22} />,
        },
        {
            id: 'month',
            label: s.tab_month,
            icon: <MaskIcon src={getSystemSymbolUrl(IcSymbolMonths, CACHE_V)} size={22} />,
        },
        {
            id: 'week',
            label: s.tab_week,
            icon: <MaskIcon src={getSystemSymbolUrl(IcSymbolWeeks, CACHE_V)} size={22} />,
        },
        {
            id: 'day',
            label: s.tab_day,
            icon: <MaskIcon src={getSystemSymbolUrl(dayIconName, CACHE_V)} size={22} />,
        },
    ];

    if (includeAgenda) items.push({ id: 'agenda', label: s.tab_agenda, icon: <IcAgenda size={22} /> });

    return (
        <div className="calendar-reference-nav flex items-center justify-around py-1.5 border-t border-gray-100 dark:border-gray-800 bg-app-surface dark:bg-black shrink-0 pb-safe">
            {items.map((item) => {
                const active = activeView === item.id;
                return (
                    <button
                        key={item.id}
                        aria-current={active ? 'page' : undefined}
                        {...(tapProps?.(item.id) ?? bindTap('home.view.switch', { params: { view: item.id } }))}
                        className="flex flex-col items-center justify-center gap-0.5 w-14 py-1"
                    >
                        <span className={active ? 'text-black dark:text-white' : 'text-gray-400'}>
                            {item.icon}
                        </span>
                        <span className={`text-[10px] ${active ? 'text-black dark:text-white font-medium' : 'text-gray-400'}`}>
                            {item.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};
