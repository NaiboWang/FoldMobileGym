import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import {useNotesStore} from '../system/Notes/state';
import {editorPatch} from '../system/Notes/editorPersistence';
import type {Note} from '../system/Notes/types';
const initial=useNotesStore.getState();
beforeEach(()=>useNotesStore.setState(initial,true));
afterEach(()=>useNotesStore.setState(initial,true));
describe('actual Notes checklist publications',()=>{
  it('creates one real structured note and clones its authored rows',()=>{
    const before=useNotesStore.getState().createdCount,rows=[{id:'authored',text:'A real row',completed:false}];
    const note=useNotesStore.getState().addNote({hasChecklist:true,checklist:rows});rows[0].text='outside mutation';
    expect(note.hasChecklist).toBe(true);expect(note.checklist![0].text).toBe('A real row');expect(useNotesStore.getState().createdCount).toBe(before+1);
  });
  it('changes only checklist and timestamp on an existing list, including absent legacy metadata',()=>{
    const before={id:'list',title:'Protected title',content:'Protected description',updatedAt:1,hasChecklist:true,checklist:[]} as unknown as Note;
    const sibling={id:'sibling',title:'Keep',content:'No change',updatedAt:1,folderId:'unfiled'};
    useNotesStore.setState({notes:[before,sibling],createdCount:7});
    const loaded={title:before.title,content:before.content,folderId:'unfiled',hasChecklist:true,checklist:[]};
    const patch=editorPatch(loaded,{...loaded,checklist:[{id:'new-item',text:'Copied fact',completed:false}]});
    useNotesStore.getState().updateNote('list',patch);
    const after=useNotesStore.getState().notes.find(note=>note.id==='list')!;
    const {checklist:_a,updatedAt:_b,...oldMetadata}=before,{checklist:_c,updatedAt:_d,...newMetadata}=after;
    expect(newMetadata).toEqual(oldMetadata);expect('folderId' in after).toBe(false);
    expect(after.checklist).toEqual(patch.checklist);expect(useNotesStore.getState().createdCount).toBe(7);
    expect(useNotesStore.getState().notes.find(note=>note.id==='sibling')).toBe(sibling);
  });
  it('rejects malformed duplicate rows without consuming a state revision',()=>{
    const note=useNotesStore.getState().addNote({title:'Keep',hasChecklist:true,checklist:[]}),before=useNotesStore.getState();
    const item={id:'duplicate',text:'X',completed:false};before.updateNote(note.id,{checklist:[item,item]});expect(useNotesStore.getState()).toBe(before);
  });
  it('rejects malformed creation before incrementing any business count',()=>{
    const before=useNotesStore.getState();expect(()=>before.addNote({hasChecklist:true,checklist:[{id:'bad',text:'X',completed:'not a boolean'} as never]})).toThrow('Invalid note checklist');expect(useNotesStore.getState()).toBe(before);
  });
});
