import type { Locale } from '../../../os/locale';
import { fromTimestamp } from '../../../os/TimeService';

/** Local simulator time; invalid or legacy values remain unknown. */
export function formatHistoryVisit(timestamp: number | undefined, locale: Locale): string | null {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return null;
  const date = fromTimestamp(timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  const pad = (value: number) => String(value).padStart(2, '0');
  const y = date.getFullYear(), m = pad(date.getMonth() + 1), d = pad(date.getDate());
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return locale === 'en' ? `${y}-${m}-${d} ${time}` : `${y}年${m}月${d}日 ${time}`;
}
