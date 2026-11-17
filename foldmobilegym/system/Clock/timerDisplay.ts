type TotalStrings = {
  timer_total_minutes_prefix: string;
  timer_total_minutes_suffix: string;
  timer_total_duration_prefix: string;
  timer_total_duration_suffix: string;
};

export function formatTimerValue(seconds: number): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds % 3600 / 60))}:${pad(seconds % 60)}`;
}

export function formatTimerTotal(seconds: number, s: TotalStrings): string {
  return seconds % 60 === 0
    ? `${s.timer_total_minutes_prefix}${seconds / 60}${s.timer_total_minutes_suffix}`
    : `${s.timer_total_duration_prefix}${formatTimerValue(seconds)}${s.timer_total_duration_suffix}`;
}
