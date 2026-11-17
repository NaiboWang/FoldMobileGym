/** Case-insensitive literal matching without HTML interpretation or regex injection. */
export function literalHighlightParts(text: string, query: string): Array<{ text: string; matched: boolean }> {
  if (!query) return [{ text, matched: false }];
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pieces = text.split(new RegExp(`(${escaped})`, 'gi'));
  return pieces.map((piece, index) => ({ text: piece, matched: index % 2 === 1 }));
}
