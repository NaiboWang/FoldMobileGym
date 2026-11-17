import { useContext, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useActivityId } from '@/os/ActivityContext';
import { CalendarSurfaceContext } from '../components/CalendarSurfaceContext';
/** Only the currently interactive route surface may open/replace navigation once. */
export function useCalendarSurfaceAction() {
  const background = useContext(CalendarSurfaceContext), location = useLocation(), activityId = useActivityId();
  const pending = useRef<string | null>(null), mounted = useRef(true), live = useRef({key:location.key,background});
  live.current={key:location.key,background};
  useEffect(() => { mounted.current=true; return()=>{mounted.current=false}; },[]);
  useEffect(() => { pending.current=null; },[background,location.key]);
  return (action:()=>void) => {
    const state=window.__OS__?.getState(), top=state?.tasks.find(task=>task.taskId===state.activeTaskId)?.stack.at(-1);
    if(!mounted.current||live.current.background||live.current.key!==location.key||top?.activityId!==activityId||pending.current===location.key)return;
    pending.current=location.key; action();
  };
}
