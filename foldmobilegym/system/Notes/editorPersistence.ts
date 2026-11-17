import { cloneNoteImages, sameNoteImages, type NoteImage } from './noteImages';
import { authoredChecklist, checklistFields, sameChecklist, type NoteChecklistFields } from './noteChecklist';
/** Publish authored text and optional image blocks before a lifecycle event can destroy local React state.
 * Empty new editors are not notes; a new editor gets at most one business ID.
 */
export type EditorTextDraft = NoteChecklistFields & {
  title: string; content: string; folderId: string;
  images?: NoteImage[];
  isNew: boolean; isTrashed: boolean; existingId?: string;
};
type TextFields = Pick<EditorTextDraft, 'title' | 'content' | 'folderId' | 'images' | 'hasChecklist' | 'checklist'>;

export const editorFields=(draft:TextFields):TextFields=>({title:draft.title,content:draft.content,folderId:draft.folderId,...checklistFields(draft),...(draft.images!==undefined?{images:cloneNoteImages(draft.images)}:{})});
export const sameEditorFields=(left:TextFields,right:TextFields)=>(left.title??'')===(right.title??'')&&(left.content??'')===(right.content??'')&&(left.folderId??'unfiled')===(right.folderId??'unfiled')&&sameNoteImages(left.images,right.images)&&sameChecklist(left,right);
/** Only authored changes are written; unchanged/absent metadata stays byte-for-byte. */
export function editorPatch(before:TextFields,after:TextFields):Partial<TextFields>{
  const patch:Partial<TextFields>={};
  if(before.title!==after.title)patch.title=after.title;
  if(before.content!==after.content)patch.content=after.content;
  if(before.folderId!==after.folderId)patch.folderId=after.folderId;
  if(!sameNoteImages(before.images,after.images))patch.images=cloneNoteImages(after.images??[]);
  if(!!before.hasChecklist!==!!after.hasChecklist)patch.hasChecklist=!!after.hasChecklist;
  if(!sameChecklist({checklist:before.checklist},{checklist:after.checklist}))patch.checklist=checklistFields({checklist:after.checklist??[]}).checklist;
  return patch;
}

export function persistEditorText(
  draft: EditorTextDraft,
  createdId: string | null,
  addNote: (fields: TextFields) => { id: string },
  updateNote: (id: string, fields: TextFields) => void,
): string | null {
  if (draft.isTrashed) return createdId;
  const id = draft.isNew ? createdId : draft.existingId;
  if (!draft.isNew && !id) return null; // Never turn a missing old note into a new one.
  const fields = editorFields(draft);
  if (id) { updateNote(id, fields); return id; }
  if (!draft.title.trim() && !draft.content.trim() && !draft.images?.length && !authoredChecklist(draft)) return null;
  return addNote(fields).id;
}
