import { parseBook } from './bookParser';
import type { ParsedBook } from '../data/types';
import defaults from '../data/defaults.json';

// The app-asset mirror already serves these files in development and production.
// Use the catalog as a whitelist, so book text is neither bundled into JS nor
// emitted a second time under dist/assets.
const knownBookFiles = new Set(defaults.store.flatMap((book) =>
  'contentSource' in book && typeof book.contentSource === 'string' ? [book.contentSource] : [],
));

const cache = new Map<string, ParsedBook>();
const inFlight = new Map<string, Promise<ParsedBook>>();

export async function loadBook(filename: string): Promise<ParsedBook | null> {
  const cached = cache.get(filename);
  if (cached) return cached;

  const existing = inFlight.get(filename);
  if (existing) return existing;

  if (!knownBookFiles.has(filename)) return null;
  const url = `/@app-assets/WechatReading/books/${encodeURIComponent(filename)}`;
  const pending = (async () => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Book asset request failed: ${response.status}`);
    const parsed = parseBook(await response.text());
    cache.set(filename, parsed);
    return parsed;
  })();
  inFlight.set(filename, pending);
  try {
    return await pending;
  } finally {
    // Failed requests are never retained, so the reader can retry.
    inFlight.delete(filename);
  }
}

export function getCachedBook(filename: string): ParsedBook | null {
  return cache.get(filename) ?? null;
}
