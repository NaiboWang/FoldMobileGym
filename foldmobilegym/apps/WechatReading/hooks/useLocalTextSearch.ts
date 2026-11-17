import { useEffect, useState } from 'react';
import type { Book } from '../data/types';
import { loadBook } from '../utils/bookLoader';
import { findTextExcerpt } from '../utils/localTextSearch';

type TextHit = { book: Book; excerpt: string };
type SearchResult = { query: string; hits: TextHit[]; loading: boolean; failures: number };

export function useLocalTextSearch(books: Book[], query: string, enabled: boolean) {
  const [result, setResult] = useState<SearchResult>({ query: '', hits: [], loading: false, failures: 0 });
  useEffect(() => {
    if (!enabled || !query.trim()) return;
    let cancelled = false;
    const candidates = books.filter(book => book.contentSource || book.content);
    let cursor = 0, failures = 0;
    const hits = new Map<string, TextHit>();
    setResult({ query, hits: [], loading: true, failures: 0 });
    const worker = async () => {
      while (!cancelled && cursor < candidates.length) {
        const book = candidates[cursor++];
        try {
          const parsed = book.contentSource ? await loadBook(book.contentSource) : null;
          if (cancelled) return;
          const texts = parsed ? parsed.chapters.map(chapter => chapter.content) : book.content ? [book.content] : [];
          const excerpt = texts.map(text => findTextExcerpt(text, query)).find(Boolean);
          if (excerpt) hits.set(book.id, { book, excerpt });
          if (!texts.length) failures++;
        } catch { if (!cancelled) failures++; }
      }
    };
    // Bound asset IO; loadBook shares its existing in-flight/cache with the reader.
    Promise.all([worker(), worker()]).then(() => {
      if (!cancelled) setResult({ query, hits: candidates.flatMap(book => hits.has(book.id) ? [hits.get(book.id)!] : []), loading: false, failures });
    });
    return () => { cancelled = true; };
  }, [books, query, enabled]);
  if (!enabled || !query.trim()) return { hits: [], loading: false, failures: 0 };
  return result.query === query ? result : { hits: [], loading: true, failures: 0 };
}
