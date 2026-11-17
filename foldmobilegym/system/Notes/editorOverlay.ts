import { isFullNoteEditor } from './editorView';
export const NOTE_EDITOR_SHEETS = ['ai', 'menu', 'folder', 'reminder', 'delete', 'permanentDelete', 'search'] as const;
export const NOTE_EDITOR_PARALLEL_SHEETS = [...NOTE_EDITOR_SHEETS, 'create'] as const;
export type NoteEditorSheet = typeof NOTE_EDITOR_PARALLEL_SHEETS[number];
export function getNoteEditorSheet(pathname: string, search: string): NoteEditorSheet | null {
  if (!/^\/note\/[^/]+$/.test(pathname)) return null;
  const sheet = new URLSearchParams(search).get('sheet');
  if (sheet === 'create') return isFullNoteEditor(pathname, search) ? null : 'create';
  return NOTE_EDITOR_SHEETS.includes(sheet as typeof NOTE_EDITOR_SHEETS[number]) ? sheet as NoteEditorSheet : null;
}
export function noteEditorParent(pathname: string, search: string) {
  const params = new URLSearchParams(search); params.delete('sheet');
  return pathname + (params.size ? `?${params}` : '');
}
export function noteEditorBackFallback(pathname: string, search: string, previous?: { pathname: string; search: string }) {
  if (!getNoteEditorSheet(pathname, search)) return null;
  return previous?.pathname === pathname && !getNoteEditorSheet(previous.pathname, previous.search)
      && isFullNoteEditor(previous.pathname, previous.search) === isFullNoteEditor(pathname, search)
    ? null : noteEditorParent(pathname, search);
}
