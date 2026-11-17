import React from 'react';
import { useCalendarMainScrollName } from './CalendarSurfaceContext';
import * as TimeService from '@/os/TimeService';
import { useAppStrings } from '@/os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
export interface CalendarMonthAgendaItem {
  id?: string; title: string; subtitle: string; color?: string; timeLabel?: string; timeValue?: string;
  tapProps?: React.HTMLAttributes<HTMLButtonElement>;
}
export function CalendarMonthAgenda({ date, lunarTitle, items }: { date: Date; lunarTitle: string; items: CalendarMonthAgendaItem[] }) {
  const s=useAppStrings(strings,stringsEn), now=TimeService.getDate(), mainScrollName=useCalendarMainScrollName();
  const today=date.getFullYear()===now.getFullYear()&&date.getMonth()===now.getMonth()&&date.getDate()===now.getDate();
  const dayLabel=today?s.month_agenda_today:s.home_month_day.replace('{{month}}',String(date.getMonth()+1)).replace('{{day}}',String(date.getDate()));
  return <section className="calendar-month-agenda" data-calendar-month-agenda>
    <div className="calendar-month-agenda-grip" aria-hidden="true" />
    <h2>{dayLabel} <span>{s.month_agenda_lunar} {lunarTitle}</span></h2>
    <div className="calendar-month-agenda-items" data-scroll-container={mainScrollName} data-scroll-direction="vertical">
      {items.map((item,index)=>{
        const content=<><span className="calendar-month-agenda-marker" style={{backgroundColor:item.color||'#ed6b4d'}} aria-hidden="true" /><span className="calendar-month-agenda-title"><strong>{item.title}</strong>{!item.timeLabel&&<small>{item.subtitle}</small>}</span>{item.timeLabel&&<span className="calendar-month-agenda-times"><span>{item.timeLabel}</span>{item.timeValue&&<span>{item.timeValue}</span>}</span>}</>;
        return item.tapProps?<button type="button" key={item.id??index} {...item.tapProps} className="calendar-month-agenda-item" data-benchmark-source-id={item.id !== 'empty' && item.id !== 'special' ? item.id : undefined}>{content}</button>:<div key={item.id??index} className="calendar-month-agenda-item">{content}</div>;
      })}
    </div>
  </section>;
}
