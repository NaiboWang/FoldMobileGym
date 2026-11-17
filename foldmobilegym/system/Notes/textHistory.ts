import { cloneNoteImages, sameNoteImages, type NoteImage } from './noteImages';
import { checklistFields, sameChecklist, type NoteChecklistFields } from './noteChecklist';
export type EditorField = 'title' | 'content';
export interface EditorSelection { field: EditorField; start: number; end: number; direction?: 'forward' | 'backward' | 'none'; itemId?:string }
export interface EditorText extends NoteChecklistFields { title: string; content: string; images?: NoteImage[] }
export interface TextSnapshot extends EditorText { selection: EditorSelection }
interface Change { before: TextSnapshot; after: TextSnapshot; inputType: string; time: number; composition?: number }
const copy = (snapshot: TextSnapshot): TextSnapshot => ({ ...snapshot, ...checklistFields(snapshot), ...(snapshot.images !== undefined ? { images: cloneNoteImages(snapshot.images) } : {}), selection: { ...snapshot.selection } });
const snapshotSize = (snapshot: TextSnapshot) => snapshot.title.length + snapshot.content.length
  + (snapshot.images ?? []).reduce((sum, image) => sum + image.id.length + image.source.id.length + image.source.path.length + 8, 0)
  + (snapshot.checklist??[]).reduce((sum,row)=>sum+row.id.length+row.text.length+1,0);
const sameSelection = (a: EditorSelection, b: EditorSelection) => a.field === b.field && a.itemId===b.itemId && a.start === b.start && a.end === b.end;
function selectionFor(text: EditorText, value: EditorSelection): EditorSelection {
  const length = value.itemId ? text.checklist?.find(row=>row.id===value.itemId)?.text.length??0 : text[value.field].length;
  const start = Math.min(length, Math.max(0, Number.isFinite(value.start) ? value.start : 0));
  return { ...value, start, end: Math.min(length, Math.max(start, Number.isFinite(value.end) ? value.end : start)) };
}
/** Transient per-editor history. Text still publishes through the existing Notes store. */
export function createTextHistory(initial: EditorText, options: { maxEntries?: number; maxCharacters?: number } = {}) {
  let current: TextSnapshot = copy({ ...initial, selection: { field: 'content', start: 0, end: 0 } });
  let past: Change[] = [], future: Change[] = [], mayMerge = false;
  const maxEntries = Math.max(1, options.maxEntries ?? 100), maxCharacters = Math.max(1, options.maxCharacters ?? 2_000_000);
  const trim = () => {
    const size = () => past.reduce((sum, item) => sum + snapshotSize(item.before) + snapshotSize(item.after), 0);
    while (past.length > 1 && (past.length > maxEntries || size() > maxCharacters)) past.shift();
  };
  return {
    getSnapshot: () => copy(current),
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    breakGroup: () => { mayMerge = false; },
    select: (selection: EditorSelection) => {
      const next = selectionFor(current, selection);
      if (!sameSelection(current.selection, next)) mayMerge = false;
      current = { ...current, selection: next };
    },
    reset: (text: EditorText) => {
      current = copy({ ...text, selection: { field: 'content', start: 0, end: 0 } });
      past = []; future = []; mayMerge = false;
    },
    record: (text: EditorText, beforeSelection: EditorSelection, afterSelection: EditorSelection,
      event: { inputType: string; time: number; composition?: number }) => {
      if (text.title === current.title && text.content === current.content && sameNoteImages(text.images, current.images) && sameChecklist(text,current)) return false;
      const before = copy({ ...current, selection: selectionFor(current, beforeSelection) });
      const after = copy({ ...text, selection: selectionFor(text, afterSelection) });
      const last = past.at(-1), kind = event.inputType;
      const composition = event.composition !== undefined && last?.composition === event.composition;
      const continuous = ['insertText', 'deleteContentBackward', 'deleteContentForward'].includes(kind)
        && kind === last?.inputType && event.time >= last.time && event.time - last.time <= 750
        && sameSelection(before.selection, last.after.selection) && before.selection.start === before.selection.end;
      if (mayMerge && last && last.after.selection.field === after.selection.field && last.after.selection.itemId===after.selection.itemId && (composition || continuous)) {
        last.after = after; last.time = event.time;
      } else past.push({ before, after, ...event });
      current = after; future = []; mayMerge = true; trim(); return true;
    },
    undo: (): TextSnapshot | null => {
      const change = past.pop(); if (!change) return null;
      future.push(change); current = copy(change.before); mayMerge = false; return copy(current);
    },
    redo: (): TextSnapshot | null => {
      const change = future.pop(); if (!change) return null;
      past.push(change); current = copy(change.after); mayMerge = false; trim(); return copy(current);
    },
  };
}
