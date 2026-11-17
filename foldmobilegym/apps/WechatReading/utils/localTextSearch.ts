import type { Book, LikedListBookEntry } from '../data/types';

/** Literal matching only; snippets never stand in for a missing local text. */
export function findTextExcerpt(text: string, query: string, context = 45): string | null {
  const needle = query.trim();
  if (!needle) return null;
  const index = text.toLocaleLowerCase().indexOf(needle.toLocaleLowerCase());
  if (index < 0) return null;
  const start = Math.max(0, index - context), end = Math.min(text.length, index + needle.length + context);
  return `${start ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

export function matchesOwnedBookList(query: string, title: string, owner: string, entries: LikedListBookEntry[], books: Book[]): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return false;
  const ids = new Set(entries.map(entry => entry.bookId));
  const values = [title, owner, ...entries.map(entry => entry.recommendation || ''), ...books.filter(book => ids.has(book.id)).flatMap(book => [book.title, book.author])];
  return values.some(value => value.toLocaleLowerCase().includes(needle));
}
