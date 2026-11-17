/** Mainland-China national rest/makeup days; local dates, not a timezone override.
 * Facts transcribed from State Council annual notices, not third-party code.
 * Ordinary weekends are rest days; workday/holiday modes are complements.
 * No weekday approximation is made outside the explicitly covered years.
 */
export const WORK_CALENDAR_SOURCES = [
  'https://www.gov.cn/zhengce/zhengceku/202411/content_6986383.htm',
  'https://www.gov.cn/zhengce/content/202511/content_7047090.htm',
  'https://www.gov.cn/zhengce/content/202611/content_7085101.htm',
] as const;
const rest: Record<number, readonly (readonly [string, string])[]> = {
  2025: [['01-01','01-01'],['01-28','02-04'],['04-04','04-06'],['05-01','05-05'],['05-31','06-02'],['10-01','10-08']],
  2026: [['01-01','01-03'],['02-15','02-23'],['04-04','04-06'],['05-01','05-05'],['06-19','06-21'],['09-25','09-27'],['10-01','10-07']],
  2027: [['01-01','01-03'],['02-05','02-13'],['04-03','04-05'],['05-01','05-05'],['06-09','06-09'],['09-15','09-15'],['10-01','10-07']],
};
const makeup: Record<number, readonly string[]> = {
  2025: ['01-26','02-08','04-27','09-28','10-11'],
  2026: ['01-04','02-14','02-28','05-09','09-20','10-10'],
  2027: ['01-31','02-14','05-08','09-26','10-09'],
};
export type WorkCalendarDay = 'workday' | 'rest' | 'unavailable';
export function workCalendarDay(date: Date): WorkCalendarDay {
  if (!Number.isFinite(date.getTime())) return 'unavailable';
  const year = date.getFullYear(), ranges = rest[year];
  if (!ranges) return 'unavailable';
  const key = `${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  if (makeup[year].includes(key)) return 'workday';
  if (ranges.some(([start,end]) => key >= start && key <= end)) return 'rest';
  return date.getDay() === 0 || date.getDay() === 6 ? 'rest' : 'workday';
}
