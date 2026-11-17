/** Match receiving/query MIME filters, including the documented universal wildcard. */
export function matchesIntentMime(filterType: string | undefined, intentType: string | undefined): boolean {
  if (!filterType) return true;
  if (!intentType) return false;
  if (filterType === '*/*') return true;
  if (filterType.endsWith('/*')) return intentType.startsWith(filterType.slice(0, -1));
  return filterType === intentType;
}
