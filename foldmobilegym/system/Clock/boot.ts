import { alarmRuntime } from './alarmRuntime';
/** Persisted alarms are armed on OS boot, before the first Clock UI Task. */
export function boot(){alarmRuntime.start();}
