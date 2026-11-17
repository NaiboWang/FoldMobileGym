export interface CalendarSurfaceLocation { pathname: string; search: string; hash: string; state: unknown; key: string }
export const isCalendarEditor = (pathname: string) => pathname === '/new-event' || /^\/event\/[^/]+\/edit$/.test(pathname);
/** UI-only route provenance. No business record or invented history entry is created. */
export function calendarEditorBackground(current: CalendarSurfaceLocation, previous?: CalendarSurfaceLocation): CalendarSurfaceLocation {
  const match = /^\/event\/([^/]+)\/edit$/.exec(current.pathname);
  const detail = match ? `/event/${match[1]}` : null;
  if (previous && !isCalendarEditor(previous.pathname)) {
    if (detail && previous.pathname === detail && !new URLSearchParams(previous.search).has('deleteConfirm')) return previous;
    if (!detail && (previous.pathname === '/' || /^\/event\/[^/]+$/.test(previous.pathname))) return previous;
  }
  const params=new URLSearchParams();const day=new URLSearchParams(current.search).get('agendaDate');if(detail&&day)params.set('agendaDate',day);
  return { ...current, pathname: detail ?? '/', search: params.size?'?'+params.toString():'', hash: '', state: null, key: `calendar-backdrop:${detail ?? 'home'}` };
}

const normalizedSearch=(search:string)=>{const params=new URLSearchParams(search);params.sort();return params.toString()};
/** Cold/external editor entries may not have the parent currently drawn behind them in MemoryRouter history. */
export function calendarEditorBackFallback(pathname:string,search:string,previous?:Pick<CalendarSurfaceLocation,'pathname'|'search'>):string|null{
  if(!isCalendarEditor(pathname))return null;
  const params=new URLSearchParams(search);
  if(params.has('sheet')){
    params.delete('sheet');const parentSearch=params.size?'?'+params.toString():'';
    return previous?.pathname===pathname&&normalizedSearch(previous.search)===normalizedSearch(parentSearch)
      ? null : pathname+parentSearch;
  }
  const current:CalendarSurfaceLocation={pathname,search,hash:'',state:null,key:'current'};
  const parent=previous?{...previous,hash:'',state:null,key:'previous'}:undefined;
  const background=calendarEditorBackground(current,parent);
  return parent&&background===parent ? null : background.pathname+background.search;
}
