import {describe,expect,it} from 'vitest';
import {noteTextShareIntent,type NoteShareSource} from '../system/Notes/noteTextShare';
const source=(title='',content=''):NoteShareSource=>({title,content});
describe('Note text-share snapshot, not image/audio or message publication',()=>{
 it('preserves original Unicode, whitespace and line breaks in both aliases',()=>{const text='  标题 📝  \n\n第一行\n第二行\n';const intent=noteTextShareIntent(source('  标题 📝  ','第一行\n第二行\n'));expect(intent).toEqual({action:'ACTION_SEND',type:'text/plain',data:{text,body:text}});});
 it('does not invent a title for an untitled authored body',()=>expect(noteTextShareIntent(source('','body'))?.data?.text).toBe('body'));
 it('allows title-only authored notes',()=>expect(noteTextShareIntent(source('title','  '))?.data?.text).toBe('title'));
 for(const [title,content] of [['',''],['  ','\n\t']])it('rejects blank text without creating a phantom note '+JSON.stringify([title,content]),()=>expect(noteTextShareIntent(source(title,content))).toBeNull());
 it('serializes authored checklist order and completion without hidden empty rows',()=>expect(noteTextShareIntent({...source('Checklist'),hasChecklist:true,checklist:[{id:'a',text:'A',completed:true},{id:'b',text:' B ',completed:false},{id:'c',text:' ',completed:false}]})?.data?.text).toBe('Checklist\n\n☑ A\n☐  B '));
 it('does not share dormant checklist fields',()=>expect(noteTextShareIntent({...source(),hasChecklist:false,checklist:[{id:'a',text:'hidden',completed:true}]})).toBeNull());
 it('does not include folder/privacy/IDs/media or mutate the source object',()=>{const note=Object.freeze({...source('title','body'),id:'private-id',isPrivate:true,folderId:'private-folder',images:[{uri:'not-a-text-attachment'}]});const intent=noteTextShareIntent(note);expect(intent?.data).toEqual({text:'title\n\nbody',body:'title\n\nbody'});expect(note.id).toBe('private-id');});
 it('snapshots strings without retaining mutable checklist references',()=>{const note={...source(),hasChecklist:true,checklist:[{id:'a',text:'Original',completed:false}]};const intent=noteTextShareIntent(note);note.checklist[0].text='Changed';expect(intent?.data?.text).toBe('☐ Original');});
});
