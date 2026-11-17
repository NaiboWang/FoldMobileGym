/** Literal, non-overlapping Unicode case-insensitive matches in authored text. */
export interface NoteSearchDocument { id: string; text: string }
export interface NoteTextMatch { documentId: string; start: number; end: number }
export function findNoteText(documents: readonly NoteSearchDocument[], query: string): NoteTextMatch[] {
  if (!query) return [];
  const expression = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu');
  const matches: NoteTextMatch[] = [];
  for (const document of documents) {
    for (const match of document.text.matchAll(expression)) {
      matches.push({ documentId: document.id, start: match.index, end: match.index + match[0].length });
    }
  }
  return matches;
}
export function nextNoteTextMatch(index: number, direction: -1 | 1, count: number) {
  return count > 0 ? ((index + direction) % count + count) % count : 0;
}
