import type { Book, BookProgress } from '../data/types';

export type ShelfSort = 'default' | 'title' | 'recommendation' | 'category' | 'words' | 'progress';
const collator = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' });
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const numeric = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

/** Visual projection only. Missing metadata follows known values; ties retain source order. */
export function sortShelfItems<T extends { bookId: string; book?: Book; isPinned?: boolean }>(
  items: readonly T[], sort: ShelfSort, progress: Readonly<Record<string, BookProgress>> = {},
): T[] {

  const estimatedProgress = (item: T) => {
    const record = progress[item.bookId];
    const total = numeric(item.book?.totalWords), offset = numeric(record?.charOffset);
    return record && String(record.bookId) === item.bookId && total !== null && total > 0 && offset !== null
      ? Math.min(offset / total, 1) : null;
  };
  return [...items].sort((left, right) => {
    const pinOrder = Number(right.isPinned === true) - Number(left.isPinned === true);
    if (pinOrder || sort === 'default') return pinOrder;
    const a = sort === 'progress' ? estimatedProgress(left) : sort === 'title' ? text(left.book?.title) : sort === 'category' ? text(left.book?.category)
      : sort === 'words' ? numeric(left.book?.totalWords) : numeric(left.book?.recommendedValue);
    const b = sort === 'progress' ? estimatedProgress(right) : sort === 'title' ? text(right.book?.title) : sort === 'category' ? text(right.book?.category)
      : sort === 'words' ? numeric(right.book?.totalWords) : numeric(right.book?.recommendedValue);
    if (a === null) return b === null ? 0 : 1;
    if (b === null) return -1;
    return typeof a === 'string' && typeof b === 'string' ? collator.compare(a, b) : Number(b) - Number(a);
  });
}
