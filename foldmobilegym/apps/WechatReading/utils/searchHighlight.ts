/** Treat search terms as literal text, never user-authored regular expressions. */
export function splitSearchHighlight(text: string, query: string): string[] {
  if (!query) return [text];
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.split(new RegExp(`(${escaped})`, 'gi'));
}
