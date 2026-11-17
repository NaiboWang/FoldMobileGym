export type AlarmRepeat = 'once' | 'daily' | 'workday' | 'holiday' | 'weekday';
export type AlarmTone = 'classic' | 'soft' | 'bright';

export interface ClockSettings { gradualVolume: boolean }

export interface Alarm {
  id: string;
  hour: number;
  minute: number;
  enabled: boolean;
  repeat: AlarmRepeat;
  note?: string;
  /** 响铃时振动，默认 true */
  vibrate: boolean;
  /** 响铃后删除此闹钟，默认 false */
  autoDelete: boolean;
  /** Locally generated browser alert profile; absent legacy values use classic. */
  tone?: AlarmTone;
}

export interface WorldCity {
  id: string;
  name: string;
  country: string;
  gmtOffsetMinutes: number;
}

