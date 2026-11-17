import type { Note, NotesFolder } from './types';
import { strings } from './res/strings';

/** Epoch zero is a valid trash timestamp; invalid/missing values are not. */
export function isNoteTrashed(note: Pick<Note, 'trashedAt'> | null | undefined): boolean {
  return typeof note?.trashedAt === 'number' && Number.isFinite(note.trashedAt);
}

/** Keep IDs distinct across active/private/trash notes and out of the new-editor route. */
export function createNoteId(notes: readonly Pick<Note, 'id'>[], candidate: string): string {
  const occupied = new Set(['new', ...notes.map(note => note.id)]);
  const base = candidate || 'note';
  let id = base, suffix = 1;
  while (occupied.has(id)) id = `${base}-${suffix++}`;
  return id;
}

export function getFolderDisplayName(
  folder: Pick<NotesFolder, 'id' | 'name' | 'system'>,
  s: typeof strings,
): string {
  if (!folder.system) return folder.name;

  switch (folder.id) {
    case 'all':
      return s.folder_all;
    case 'call':
      return s.folder_call;
    case 'unfiled':
      return s.folder_unfiled;
    default:
      return folder.name;
  }
}
