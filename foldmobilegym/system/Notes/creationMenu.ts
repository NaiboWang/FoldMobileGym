import { getNoteEditorSheet } from './editorOverlay';
export function isNoteCreationMenu(pathname: string, search: string): boolean {
  return pathname === '/' ? new URLSearchParams(search).get('sheet') === 'create' : getNoteEditorSheet(pathname, search) === 'create';
}
export function noteCreationHomeBackFallback(pathname: string, search: string, previous?: { pathname: string; search: string }) {
  if (pathname !== '/' || !isNoteCreationMenu(pathname, search)) return null;
  return previous?.pathname === '/' && !isNoteCreationMenu(previous.pathname, previous.search) ? null : '/';
}
