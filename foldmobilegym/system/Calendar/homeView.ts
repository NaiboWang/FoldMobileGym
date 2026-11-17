/** Root views replace history; a cold menu must restore its own view. */
export function calendarHomeMenuFallback(pathname:string, search:string, previous?:{pathname:string;search:string}):string|null {
  if(pathname!=='/'||new URLSearchParams(search).get('menu')!=='open')return null;
  const viewOf=(query:string)=>{const v=new URLSearchParams(query).get('view');return ['year','week','day','agenda'].includes(v??'')?v:'month';};
  const view=viewOf(search);
  if(previous?.pathname==='/'&&new URLSearchParams(previous.search).get('menu')!=='open'&&viewOf(previous.search)===view)return null;
  return view==='month'?'/':`/?view=${view}`;
}
