import type { Alarm } from './types';

type Plan = { source: Alarm; at: number };
export type AlarmEngineOptions = {
  alarms: () => readonly Alarm[];
  now: () => number;
  next: (alarm: Alarm, now: number) => number;
  fire: (alarm: Alarm, triggerAtMs: number) => void;
};
/** Current-source plans and per-schedule high watermarks, independent of UI Tasks.
 * TIME_SET discontinuities only catch the due minute, not hours/days of old alerts.
 * Real elapsed polling may deliver late after a suspended browser resumes.
 */
export function createAlarmEngine(options: AlarmEngineOptions) {
  const plans = new Map<string, Plan>(), fired = new Map<string, number>();
  let previous = options.now(), busy = false, queued = false;
  const signature = (alarm: Alarm) => JSON.stringify([alarm.id,alarm.hour,alarm.minute,alarm.repeat]);
  function refresh(timeSet = false) {
    if (busy) { queued = true; return; }
    const now = options.now();
    if (!Number.isFinite(now)) return;
    busy = true;
    try {
      const backward = now < previous;
      previous = now;
      const alarms = options.alarms(), counts = new Map<string,number>();
      for (const alarm of alarms) counts.set(alarm.id,(counts.get(alarm.id)??0)+1);
      for (const [id,plan] of plans) {
        const source = alarms.find(alarm => alarm.id === id);
        if (!source?.enabled || source !== plan.source || counts.get(id) !== 1 || backward) plans.delete(id);
      }
      for (const alarm of alarms) {
        if (!alarm.enabled || counts.get(alarm.id) !== 1) continue;
        let plan = plans.get(alarm.id);
        if (!plan) {
          plan = {source:alarm,at:options.next(alarm,now)};
          plans.set(alarm.id,plan);
          continue; // enabling/editing/cold boot arms only a future occurrence
        }
        if (!Number.isFinite(plan.at)) {
          // Coverage can become available through ordinary time, not only TIME_SET.
          plan.at=options.next(alarm,now);
          continue;
        }
        if (plan.at > now) continue;
        const at = plan.at, key = signature(alarm), last = fired.get(key)??-Infinity;
        // Latch and reschedule before calling a reentrant store/notification consumer.
        plan.at = options.next(alarm,now);
        if (at <= last || (timeSet && now-at >= 60000)) continue;
        if (options.alarms().find(item=>item.id===alarm.id) !== alarm) continue;
        fired.set(key,at);
        options.fire(alarm,at);
      }
    } finally { busy=false; }
    if (queued) { queued=false; refresh(); }
  }
  return {
    refresh,
    reset() { plans.clear(); fired.clear(); previous=options.now(); refresh(); },
    armed: () => [...plans].filter(([,plan])=>Number.isFinite(plan.at)).map(([alarmId,plan])=>({alarmId,triggerAtMs:plan.at})),
  };
}
