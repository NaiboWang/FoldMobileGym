import type { MediaItem } from '../../os/types';
import * as TimeService from '../../os/TimeService';

const normalize = (value: string) => value.normalize('NFKC').toLowerCase();
/** Literal AND terms over actual local metadata, not OCR or semantic recognition. */
export function searchMedia(items: readonly MediaItem[], query: string): MediaItem[] {
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return items.filter(item => {
    let date = '';
    if (Number.isFinite(item.createdAt)) {
      const d = TimeService.fromTimestamp(item.createdAt);
      const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
      date = `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')} ${y}/${m}/${day} ${y}年${m}月${day}日`;
    }
    const text = normalize(`${item.name}\n${item.path}\n${date}`);
    return terms.every(term => text.includes(term));
  }).sort((a,b) => b.createdAt - a.createdAt);
}
