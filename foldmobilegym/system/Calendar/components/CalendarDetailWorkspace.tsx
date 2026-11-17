import { useCalendarEventId } from '../hooks/useCalendarEventId';
import { calendarWorkspaceFocusDate } from '../workspaceAgenda';
import * as TimeService from '@/os/TimeService';
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarAgendaMaster } from './CalendarAgendaMaster';
import { CalendarBottomNav } from './CalendarBottomNav';
import { useCalendarStore, selectSelectedDate } from '../state';
import { useCalendarSurfaceAction } from '../hooks/useCalendarSurfaceAction';
import { useCalendarGestures } from '../hooks/useCalendarGestures';
import { useAppStrings } from '@/os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

export function CalendarDetailWorkspace({children}:React.PropsWithChildren) {
  const [params]=useSearchParams(), blocked=params.get('deleteConfirm')==='open';
  const selected=useCalendarStore(selectSelectedDate),id=useCalendarEventId(),event=useCalendarStore(state=>state.events.find(event=>event.id===id)),date=TimeService.fromTimestamp(calendarWorkspaceFocusDate(event,selected.getTime(),params.get('agendaDate')??undefined)),s=useAppStrings(strings,stringsEn),{bindBack,bindTap,go}=useCalendarGestures(),run=useCalendarSurfaceAction();
  return <div className="calendar-detail-workspace" data-calendar-detail-workspace>
    <header className="calendar-workspace-heading" inert={blocked}>
      <button type="button" {...bindBack()} aria-label={s.close}>←</button>
      <h1>{s.home_year_month.replace('{{year}}',String(date.getFullYear())).replace('{{month}}',String(date.getMonth()+1))}</h1>
      <span>{s.event_detail}</span>
    </header>
    <div className="calendar-workspace-navigation" inert={blocked}>
      <button type="button" className="calendar-workspace-add" aria-label={s.action_new} {...bindTap('workspace.new.open',{onTrigger:()=>run(()=>go('workspace.new.open'))})}>+</button>
      <CalendarBottomNav dayNumber={date.getDate()} tapProps={view=>bindTap('workspace.home.switch',{params:{view},onTrigger:()=>run(()=>go('workspace.home.switch',{view}))})} />
      <strong className="calendar-workspace-agenda-mode" aria-current="page">{s.workspace_agenda}</strong>
    </div>
    <div className="calendar-workspace-master-host" inert={blocked}><CalendarAgendaMaster /></div>
    <div className="calendar-workspace-detail">{children}</div>
  </div>;
}
