import { useCalendarEventId } from '../hooks/useCalendarEventId';
import React, { useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useCalendarStore, selectSelectedDate } from '../state';
import { useCalendarSurfaceAction } from '../hooks/useCalendarSurfaceAction';
import { useCalendarGestures } from '../hooks/useCalendarGestures';
import { calendarAgendaPage, calendarAgendaGroupsAtDays, calendarAgendaInitialPage, calendarWorkspaceFocusDate, calendarWorkspaceSegment, shiftCalendarWorkspaceDay } from '../workspaceAgenda';
import { CalendarSurfaceContext } from './CalendarSurfaceContext';
import { dateInputValue } from '../dateEditing';
import { useSearchParams } from 'react-router-dom';
import { useLocale } from '@/os/locale';
import { useAppStrings } from '@/os/useAppStrings';
import * as TimeService from '@/os/TimeService';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

export function CalendarAgendaMaster({ home = false }: { home?: boolean }) {
  const eventId = useCalendarEventId(), events = useCalendarStore(state => state.events), locale = useLocale();
  const selected=useCalendarStore(selectSelectedDate),[params]=useSearchParams(),blocked=useContext(CalendarSurfaceContext);
  const focused=calendarWorkspaceFocusDate(events.find(event=>event.id===eventId),selected.getTime(),params.get('agendaDate')??undefined),selectedDay=dateInputValue(focused);
  const pageDays=useMemo(()=>calendarAgendaInitialPage(events,focused).map(group=>group.dateTs),[events,focused]);
  const [days,setDays]=useState(()=>pageDays);
  const groups=useMemo(()=>calendarAgendaGroupsAtDays(events,days),[events,days]);
  const reveal=useRef(true),selectionKey=useRef(''),anchor=useRef<{key:string;offset:number}|null>(null),paging=useRef(false);
  const extend=(direction:1|-1)=>{
    const node=scroll.current;if(!node||blocked||paging.current||!groups.length)return;
    const edge=direction===1?groups.at(-1)!:groups[0],more=calendarAgendaPage(events,shiftCalendarWorkspaceDay(edge.dateTs,direction),direction);
    if(!more.length)return;
    const group=[...node.querySelectorAll<HTMLElement>('[data-calendar-agenda-group]')].find(element=>element.getBoundingClientRect().bottom>node.getBoundingClientRect().top);
    anchor.current=group?{key:group.dataset.calendarAgendaGroup!,offset:group.getBoundingClientRect().top-node.getBoundingClientRect().top}:null;
    paging.current=true;setDays(current=>[...new Set([...current,...more.map(row=>row.dateTs)])].sort((a,b)=>a-b));
  };
  const run=useCalendarSurfaceAction();
  const { bindTap, go } = useCalendarGestures(), s = useAppStrings(strings, stringsEn);
  const scroll = useRef<HTMLDivElement>(null), saved = useRef(0), restoring = useRef(false);
  useLayoutEffect(() => {
    const node = scroll.current; if (!node) return;
    let frame = 0, wasHidden = !node.clientHeight;
    const observer = new ResizeObserver(() => {
      const hidden = !node.clientHeight;
      if (wasHidden && !hidden) {
        restoring.current = true; cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => { if(reveal.current){const chosen=[...node.querySelectorAll<HTMLElement>('[aria-current="page"]')][0];chosen?.scrollIntoView({block:'nearest'});reveal.current=false;saved.current=node.scrollTop;}else node.scrollTop=saved.current;restoring.current=false; });
      }
      wasHidden = hidden;
    });
    observer.observe(node); return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);
  useLayoutEffect(() => {
    const token=`${eventId}:${selectedDay}`;if(selectionKey.current!==token){selectionKey.current=token;reveal.current=true;}
    const node = scroll.current;
    if(!days.includes(focused)){
      const next=pageDays;
      if(next.length!==days.length||next.some((day,index)=>day!==days[index])){reveal.current=true;setDays(next);}
      return;
    }
    if (node?.clientHeight) {
      const selected = [...node.querySelectorAll<HTMLElement>('[data-calendar-agenda-event]')].find(element => element.dataset.calendarAgendaEvent === eventId && element.dataset.calendarAgendaDay === selectedDay);
      if(reveal.current){selected?.scrollIntoView({ block: 'nearest' });reveal.current=false;} saved.current = node.scrollTop;
    }
  }, [eventId,selectedDay,focused,days,pageDays]);
  useLayoutEffect(()=>{
    const node=scroll.current;if(node&&anchor.current){const group=[...node.querySelectorAll<HTMLElement>('[data-calendar-agenda-group]')].find(element=>element.dataset.calendarAgendaGroup===anchor.current?.key);
      if(group)node.scrollTop+=group.getBoundingClientRect().top-node.getBoundingClientRect().top-anchor.current.offset;
      anchor.current=null;saved.current=node.scrollTop;}
    paging.current=false;
  },[days]);
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, { year:'numeric', month:'long', day:'numeric', weekday:'short' }), [locale]);
  const time = (timestamp: number) => { const date = TimeService.fromTimestamp(timestamp); return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`; };
  return <aside data-calendar-agenda-master className="calendar-workspace-master" aria-label={s.workspace_agenda}>
    <div ref={scroll} className="calendar-workspace-master-scroll" data-scroll-container="master" data-scroll-direction="vertical"
      onWheel={event=>{if(blocked)return;const node=event.currentTarget;if(event.deltaY<0&&node.scrollTop<30)extend(-1);else if(event.deltaY>0&&node.scrollTop+node.clientHeight>=node.scrollHeight-40)extend(1);}}
      onScroll={event=>{const node=event.currentTarget;if(node.clientHeight&&!restoring.current){saved.current=node.scrollTop;if(node.scrollTop<20)extend(-1);else if(node.scrollTop+node.clientHeight>=node.scrollHeight-30)extend(1);}}}>
      {groups.length ? groups.map(group => <section key={group.key} data-calendar-agenda-group={group.key} className="calendar-workspace-group">
        <h2>{dateFormat.format(TimeService.fromTimestamp(group.dateTs))}</h2>
        {group.events.map(event => <button type="button" key={event.id} data-calendar-agenda-event={event.id} data-calendar-agenda-day={group.key} data-benchmark-source-id={event.id}
          aria-current={event.id === eventId && group.key===selectedDay ? 'page' : undefined}
          {...(home ? bindTap('home.agenda.event.open', { params: {eventId:event.id,agendaDate:group.key}, onTrigger:()=>run(()=>go('home.agenda.event.open',{eventId:event.id,agendaDate:group.key})) }) : bindTap('workspace.event.select', { params:{ eventId:event.id, agendaDate:group.key }, onTrigger:()=>{ if(event.id!==eventId||group.key!==selectedDay)run(()=>go('workspace.event.select',{eventId:event.id,agendaDate:group.key})); } }))}>
          <span className="calendar-workspace-event-marker" style={{backgroundColor:event.color || '#ed6b4d'}} aria-hidden="true" />
          <span className="calendar-workspace-event-label"><strong>{event.title}</strong><small>{event.location}</small></span>
          <span className="calendar-workspace-event-time">{calendarWorkspaceSegment(event,group.dateTs)==='allDay'?s.label_all_day_value:calendarWorkspaceSegment(event,group.dateTs)==='ends'?<>{s.workspace_ends}<br/>{time(event.endTs)}</>:calendarWorkspaceSegment(event,group.dateTs)==='starts'?<>{s.workspace_starts}<br/>{time(event.startTs)}</>:calendarWorkspaceSegment(event,group.dateTs)==='continues'?s.week_continues:<>{time(event.startTs)}<br/>{time(event.endTs)}</>}</span>
        </button>)}
      </section>) : <p className="p-4 text-gray-500">{s.empty_agenda}</p>}
    </div>
  </aside>;
}
