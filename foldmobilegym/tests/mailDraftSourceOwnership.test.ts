import { beforeEach, describe, expect, it } from 'vitest';
import { useMailStore } from '../apps/Mail/state';
const initial = useMailStore.getState(), saved = { id:'same',to:'source@example.test',subject:'Source',body:'Original' };
beforeEach(()=>useMailStore.setState({...initial,drafts:[saved],draftInput:{to:'',subject:'',body:''},editorBuffers:{},_temp:{composeEpoch:0}},true));
describe('Mail live editor source identity',()=>{
 it('a replaced saved source cannot be overwritten even through direct store save',()=>{useMailStore.getState().openDraft('same');useMailStore.getState().updateDraft({body:'Stale edit'});const replacement={...saved,body:'External source'};useMailStore.setState({drafts:[replacement]});const before=useMailStore.getState();useMailStore.getState().saveDraft();expect(useMailStore.getState()).toBe(before);expect(before.drafts).toEqual([replacement]);});
 it.each(['close','message','new','same'] as const)('leaving a replaced source by %s does not rebind old text to it',mode=>{useMailStore.getState().openDraft('same');useMailStore.getState().updateDraft({body:'Stale edit'});useMailStore.setState({drafts:[{...saved,body:'Replacement'}]});if(mode==='close')useMailStore.getState().closeCompose();else if(mode==='message')useMailStore.getState().open(initial.messages[0].id);else if(mode==='new')useMailStore.getState().beginCompose();useMailStore.getState().openDraft('same');expect(useMailStore.getState().draftInput.body).toBe('Replacement');expect(useMailStore.getState().editorBuffers['saved:same']?.body).not.toBe('Stale edit');});
 it('retains exact ordinary unsaved buffers when their real source did not change',()=>{useMailStore.getState().openDraft('same');useMailStore.getState().updateDraft({body:'Unsaved current source'});useMailStore.getState().closeCompose();useMailStore.getState().openDraft('same');expect(useMailStore.getState().draftInput.body).toBe('Unsaved current source');});
 it('does not stamp an old attachment callback onto a same-ID replaced draft',()=>{useMailStore.getState().openDraft('same');const current=useMailStore.getState(),owner={key:'saved:same',epoch:current._temp.composeEpoch};useMailStore.setState({drafts:[{...saved,body:'Replacement'}]});const before=useMailStore.getState();useMailStore.getState().addAttachment(owner,{id:'file',path:'/sdcard/report.pdf',createdAt:1});expect(useMailStore.getState()).toBe(before);});
 it('missing source verification cannot create a fictional verified message',()=>{useMailStore.getState().verify('missing');expect(useMailStore.getState().verifiedIds).toEqual(initial.verifiedIds);});
 it('retains stale text in a separate recoverable buffer without creating or overwriting saved drafts',()=>{
  useMailStore.getState().openDraft('same');useMailStore.getState().updateDraft({body:'Conflict text'});const replacement={...saved,body:'Current source'};useMailStore.setState({drafts:[replacement]});useMailStore.getState().closeCompose();
  const key=Object.keys(useMailStore.getState().editorBuffers).find(key=>key.startsWith('conflict:'))!;expect(key).toBeDefined();expect(useMailStore.getState().editorBuffers[key].body).toBe('Conflict text');expect(useMailStore.getState().drafts).toEqual([replacement]);
  useMailStore.getState().openRecovery(key);expect(useMailStore.getState().editingDraftId).toBeNull();expect(useMailStore.getState().draftInput.body).toBe('Conflict text');expect(useMailStore.getState().drafts).toEqual([replacement]);
  useMailStore.getState().saveDraft();expect(useMailStore.getState().drafts).toHaveLength(2);expect(useMailStore.getState().drafts[0]).toEqual(replacement);expect(useMailStore.getState().drafts[1].body).toBe('Conflict text');
 });
 it('recovery cannot overwrite an independent unfinished new-mail buffer',()=>{
  useMailStore.getState().beginCompose();useMailStore.getState().updateDraft({body:'Independent new buffer'});useMailStore.getState().openDraft('same');useMailStore.getState().updateDraft({body:'Conflicted text'});useMailStore.setState({drafts:[{...saved,body:'Replacement'}]});useMailStore.getState().closeCompose();
  const key=Object.keys(useMailStore.getState().editorBuffers).find(key=>key.startsWith('conflict:'))!,before=useMailStore.getState();useMailStore.getState().openRecovery(key);expect(useMailStore.getState()).toBe(before);expect(before.draftInput.body).toBe('Independent new buffer');expect(before.editorBuffers[key].body).toBe('Conflicted text');
 });
 it('conflict recovery preserves each distinct invalidated edit instead of silently replacing an earlier copy',()=>{
  for(const body of ['First conflict','Second conflict']){useMailStore.getState().openDraft('same');useMailStore.getState().updateDraft({body});useMailStore.setState({drafts:[{...saved,body:'Source '+body}]});useMailStore.getState().closeCompose();}
  expect(Object.entries(useMailStore.getState().editorBuffers).filter(([key])=>key.startsWith('conflict:')).map(([,input])=>input.body)).toEqual(['First conflict','Second conflict']);
 });

});
