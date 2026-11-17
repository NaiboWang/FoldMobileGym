export function isFullNoteEditor(pathname: string, search: string): boolean {
  if (!/^\/note\/[^/]+$/.test(pathname)) return false;
  const values = new URLSearchParams(search).getAll('view');
  return values.length === 1 && values[0] === 'full';
}

/** Adopt only this editor's layout, never a stale overlay/unknown query. */
export function adoptedNoteEditorUrl(id: string, pathname: string, search: string): string {
  return `/note/${encodeURIComponent(id)}${isFullNoteEditor(pathname, search) ? '?view=full' : ''}`;
}
