import { afterEach, describe, expect, it, vi } from 'vitest';
import { isNoteTrashed } from '../system/Notes/utils';
import { useNotesStore, selectVisibleNotes, selectPrivateNotes, selectTrashedNotes } from '../system/Notes/state';
import * as TimeService from '../os/TimeService';
const initial=useNotesStore.getState();
afterEach(()=>{useNotesStore.setState(initial,true);vi.restoreAllMocks();});
describe('Notes shared trash status',()=>{
  it.each([0,-1,1,1789176600000])('recognizes the finite timestamp %s without truthiness',trashedAt=>{
    const record=Object.freeze({trashedAt});expect(isNoteTrashed(record)).toBe(true);
  });
  it.each([undefined,null,NaN,Infinity,-Infinity,'0',false])('does not invent trash status from %s',trashedAt=>{
    expect(isNoteTrashed({trashedAt} as never)).toBe(false);
  });
  it('accepts missing notes and absent optional metadata',()=>{
    expect(isNoteTrashed(undefined)).toBe(false);expect(isNoteTrashed(null)).toBe(false);expect(isNoteTrashed({})).toBe(false);
  });
  it('uses the actual store to delete and restore an epoch-zero note consistently',()=>{
    vi.spyOn(TimeService,'now').mockReturnValue(0);
    const store=useNotesStore.getState(),source=store.addNote({title:'Authored title',content:'Authored body'});
    const before=useNotesStore.getState(),siblings=before.notes.filter(n=>n.id!==source.id);
    before.deleteNote(source.id);const deleted=useNotesStore.getState(),note=deleted.notes.find(n=>n.id===source.id)!;
    expect(note.trashedAt).toBe(0);expect(isNoteTrashed(note)).toBe(true);
    expect(selectVisibleNotes(deleted).some(n=>n.id===source.id)).toBe(false);
    expect(selectTrashedNotes(deleted).find(n=>n.id===source.id)).toBe(note);
    expect(deleted.notes.filter(n=>n.id!==source.id)).toEqual(siblings);
    deleted.restoreNote(source.id);const restored=useNotesStore.getState(),live=restored.notes.find(n=>n.id===source.id)!;
    expect(isNoteTrashed(live)).toBe(false);expect(live.title).toBe(source.title);expect(live.content).toBe(source.content);
    expect(selectVisibleNotes(restored).find(n=>n.id===source.id)).toBe(live);
    expect(selectTrashedNotes(restored).some(n=>n.id===source.id)).toBe(false);
    expect(restored.deletedCount).toBe(before.deletedCount+1);expect(restored.createdCount).toBe(before.createdCount);
  });
  it('does not expose a private epoch-zero trashed record in either live collection',()=>{
    const source=useNotesStore.getState().addNote({title:'Private draft'});
    useNotesStore.getState().updateNote(source.id,{isPrivate:true,trashedAt:0});
    const state=useNotesStore.getState();
    expect(selectVisibleNotes(state).some(n=>n.id===source.id)).toBe(false);
    expect(selectPrivateNotes(state).some(n=>n.id===source.id)).toBe(false);
    expect(selectTrashedNotes(state).some(n=>n.id===source.id)).toBe(true);
  });
});
