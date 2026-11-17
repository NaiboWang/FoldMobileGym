// Weekly civil-time intervals. Place-specific time zones and holiday exceptions
// require separate source data; never infer those from a stale openNow flag.
export type WeeklyOpeningStatus = {
  isKnown: boolean;
  isOpen: boolean;
  isAlwaysOpen: boolean;
  closesAtMinute: number | null;
  nextOpening: { day: number; minute: number } | null;
};
const DAY = 1440, WEEK = 7 * DAY;
type Point = { day: number; hour: number; minute: number };
function point(value: unknown): Point | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as Partial<Point>;
  return Number.isInteger(p.day) && p.day! >= 0 && p.day! < 7
    && Number.isInteger(p.hour) && p.hour! >= 0 && p.hour! < 24
    && Number.isInteger(p.minute) && p.minute! >= 0 && p.minute! < 60
    ? p as Point : null;
}
const minuteOfWeek = (p: Point) => p.day * DAY + p.hour * 60 + p.minute;
const unknown = (): WeeklyOpeningStatus => ({isKnown:false,isOpen:false,isAlwaysOpen:false,closesAtMinute:null,nextOpening:null});

export function weeklyOpeningStatus(periods: unknown, current: {day:number;hour:number;minute:number}): WeeklyOpeningStatus {
  if (!Array.isArray(periods) || !point(current)) return unknown();
  const intervals: Array<{start:number;end:number}> = [];
  for (const period of periods) {
    if (!period || typeof period !== 'object') continue;
    const open = point(period.open);
    if (!open) continue;
    // Canonical Places 24/7 encoding: a single Sunday-midnight opening, no close.
    if (periods.length === 1 && minuteOfWeek(open) === 0 && period.close == null) {
      return {isKnown:true,isOpen:true,isAlwaysOpen:true,closesAtMinute:null,nextOpening:null};
    }
    const close = point(period.close);
    if (!close) continue;
    const start = minuteOfWeek(open);
    let end = minuteOfWeek(close);
    if (end <= start) end += WEEK;
    // Repeat on either side of Sunday so wrap-around and touching/overlapping
    // windows are evaluated as one continuous open interval.
    for (const offset of [-WEEK,0,WEEK]) intervals.push({start:start+offset,end:end+offset});
  }
  if (!intervals.length) return unknown();
  intervals.sort((a,b)=>a.start-b.start || a.end-b.end);
  const merged: Array<{start:number;end:number}> = [];
  for (const interval of intervals) {
    const last = merged.at(-1);
    if (last && interval.start <= last.end) last.end = Math.max(last.end,interval.end);
    else merged.push({...interval});
  }
  const now = minuteOfWeek(current);
  const active = merged.find(p=>p.start<=now && now<p.end);
  if (active) {
    const always = active.end-active.start >= WEEK;
    return {isKnown:true,isOpen:true,isAlwaysOpen:always,closesAtMinute:always?null:active.end%DAY,nextOpening:null};
  }
  const next = merged.find(p=>p.start>now);
  return {
    isKnown:true,isOpen:false,isAlwaysOpen:false,closesAtMinute:null,
    nextOpening:next?{day:Math.floor(next.start/DAY)%7,minute:next.start%DAY}:null,
  };
}
