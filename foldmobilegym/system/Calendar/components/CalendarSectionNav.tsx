import React, { useContext } from 'react';
import { UNSAFE_NavigationContext, useLocation } from 'react-router-dom';
import { useActivityId } from '@/os/ActivityContext';
import { IcCalendarDays, IcCalendar, IcTodo } from '../res/icons';
import { useSearchParams } from 'react-router-dom';
import { useAppStrings } from '@/os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useCalendarGestures } from '../hooks/useCalendarGestures';
export function CalendarSectionNav({selected}:{selected:'calendar'|'todos'}) {
  const [params]=useSearchParams(),location=useLocation(),activityId=useActivityId(),{navigator}=useContext(UNSAFE_NavigationContext);
  const returnView=selected==='calendar'?(params.get('view')??'month'):(params.get('returnView')??'month');
  const s=useAppStrings(strings,stringsEn),{bindTap,go}=useCalendarGestures();
  const owns=()=>{
    const live=(navigator as {location?:typeof location}).location??location;
    const os=window.__OS__?.getState(),top=os?.tasks.find(t=>t.taskId===os.activeTaskId)?.stack.at(-1);
    return live.key===location.key && live.pathname===(selected==='calendar'?'/':'/todos') && !os?.isLauncherVisible && !os?.isRecentsVisible && top?.activityId===activityId;
  };
  return <nav className="calendar-section-nav" data-hide-on-keyboard aria-label={s.app_name}>
    <button type="button" aria-current={selected==='calendar'?'page':undefined} {...(selected==='todos'?bindTap('todos.calendar.open',{params:{returnView},onTrigger:()=>{if(owns())go('todos.calendar.open',{returnView});}}):{})}><span aria-hidden="true"><IcCalendarDays size={23}/></span>{s.todos_calendar}</button>
    <button type="button" disabled title={s.todos_unavailable}><span aria-hidden="true"><IcCalendar size={23}/></span>{s.todos_myday}</button>
    <button type="button" aria-current={selected==='todos'?'page':undefined} {...(selected==='calendar'?bindTap('home.todos.open',{params:{returnView},onTrigger:()=>{if(owns())go('home.todos.open',{returnView});}}):{})}><span aria-hidden="true"><IcTodo size={25}/></span>{s.todos_title}</button>
  </nav>;
}
