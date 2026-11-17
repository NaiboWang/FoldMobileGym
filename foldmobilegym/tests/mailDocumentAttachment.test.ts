import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../os/createAppStore', async () => {
  const { createStore } = await import('zustand/vanilla');
  return { createAppStoreWithActions: (_id: string, initial: object, actions: (set: unknown) => object) => createStore(set => ({ ...initial, ...actions(set) })), registerStateAdapter: vi.fn() };
});
import { matchesIntentMime } from '../os/utils/intentMime';
import { readFileSync } from 'node:fs';
import { useMailStore } from '../apps/Mail/state';
import { documentReference, isDocumentReference, matchesDocumentReference, matchesDocumentMime, isSharedDocumentPath } from '../os/utils/documentReference';
import type { FSNode } from '../os/types';
import { NAVIGATION_DECLARATION } from '../system/FileManager/navigation.declaration';
import { manifest } from '../system/FileManager/manifest';
const node: FSNode = { id:'file-a', name:'研究.txt', path:'/sdcard/Documents/研究.txt', type:'file', parentId:'docs', createdAt:100, modifiedAt:200, size:24, mimeType:'text/plain', storage:'indexeddb' };
const reference = { id:node.id, path:node.path, createdAt:node.createdAt };
const text = { to:'research@example.invalid', subject:'Virtual attachment', body:'Unsent research draft' };
const initial = useMailStore.getState();
const owner = () => { const state=useMailStore.getState();return { key:state.editingDraftId ? `saved:${state.editingDraftId}`:'new', epoch:state._temp.composeEpoch }; };
beforeEach(() => useMailStore.setState(initial,true));
describe('Virtual document identity and MIME', () => {
  it('returns only the stable virtual-file identity, never blob/source metadata', () => {
    expect(documentReference(node)).toEqual(reference);expect(documentReference({...node,type:'directory'})).toBeNull();
    expect(documentReference({...node,path:'C:\\Users\\private.txt'})).toBeNull();
  });
  it.each(['/sdcard/../private','/sdcard/./x','/sdcard/evil\\name','file:///sdcard/a','/sdcard2/a','/etc/passwd','/sdcard/a\u0000b','/sdcard'])('rejects unsafe shared-storage path %s',path=>expect(isSharedDocumentPath(path)).toBe(false));
  it('accepts literal percent/Unicode names without URL decoding or traversal', () => {
    expect(isSharedDocumentPath('/sdcard/Documents/%2F 文档.txt')).toBe(true);expect(isDocumentReference(reference)).toBe(true);
    expect(isDocumentReference({...reference,createdAt:NaN})).toBe(false);expect(isDocumentReference({path:reference.path})).toBe(false);
  });
  it('does not rebind a deleted/replaced file, directory, or same-ID different incarnation', () => {
    expect(matchesDocumentReference(reference,node)).toBe(true);expect(matchesDocumentReference(reference,null)).toBe(false);
    expect(matchesDocumentReference(reference,{...node,id:'replacement'})).toBe(false);
    expect(matchesDocumentReference(reference,{...node,createdAt:101})).toBe(false);
    expect(matchesDocumentReference(reference,{...node,path:'/sdcard/Documents/other.txt'})).toBe(false);
    expect(matchesDocumentReference(reference,{...node,type:'directory'})).toBe(false);
  });
  it.each([['*/*',true],['text/*',true],['text/plain',true],['TEXT/PLAIN',true],['image/*',false],['application/pdf',false]])('filters MIME %s', (mime,expected)=>expect(matchesDocumentMime(node,mime as string)).toBe(expected));
  it('never selects directories even with a wildcard',()=>expect(matchesDocumentMime({...node,type:'directory'},'*/*')).toBe(false));
});
describe('Mail attachment owner and draft lifecycle', () => {
  it('adds once to the exact current editor without changing saved data', () => {
    useMailStore.getState().beginCompose();useMailStore.getState().updateDraft(text);const request=owner();
    useMailStore.getState().addAttachment(request,reference);useMailStore.getState().addAttachment(request,reference);
    expect(useMailStore.getState().draftInput).toEqual({...text,attachments:[reference]});expect(useMailStore.getState().drafts).toEqual([]);
    expect(useMailStore.getState().messages).toEqual(initial.messages);
  });
  it('persists attachment references through explicit save and same-ID update', () => {
    useMailStore.getState().beginCompose();useMailStore.getState().updateDraft(text);useMailStore.getState().addAttachment(owner(),reference);useMailStore.getState().saveDraft();
    const saved=useMailStore.getState().drafts[0];expect(saved).toEqual({id:'draft-1',...text,attachments:[reference]});
    useMailStore.getState().openDraft(saved.id);expect(useMailStore.getState().draftInput.attachments).toEqual([reference]);
    useMailStore.getState().updateDraft({subject:'Updated'});useMailStore.getState().saveDraft();
    expect(useMailStore.getState().drafts).toEqual([{...saved,subject:'Updated'}]);
  });
  it('preserves independent new/saved buffers and removal never changes the source', () => {
    useMailStore.setState({drafts:[{id:'saved',...text}]});useMailStore.getState().beginCompose();useMailStore.getState().addAttachment(owner(),reference);
    useMailStore.getState().openDraft('saved');expect(useMailStore.getState().draftInput.attachments).toBeUndefined();
    useMailStore.getState().beginCompose();expect(useMailStore.getState().draftInput.attachments).toEqual([reference]);
    useMailStore.getState().removeAttachment(reference.id);expect(useMailStore.getState().draftInput.attachments).toBeUndefined();
    expect(node).toMatchObject({id:'file-a',size:24});expect(useMailStore.getState().drafts).toEqual([{id:'saved',...text}]);
  });
  it.each(['close','reopen','message','save','other-draft','missing-draft'])('ignores late picker result after %s',change=>{
    useMailStore.setState({drafts:[{id:'saved',...text},{id:'other',...text}]});useMailStore.getState().openDraft('saved');const request=owner();
    if(change==='close')useMailStore.getState().closeCompose();
    if(change==='reopen'){useMailStore.getState().closeCompose();useMailStore.getState().openDraft('saved');}
    if(change==='message')useMailStore.getState().open(initial.messages[0].id);
    if(change==='save')useMailStore.getState().saveDraft();
    if(change==='other-draft')useMailStore.getState().openDraft('other');
    if(change==='missing-draft')useMailStore.setState({drafts:[]});
    const before=useMailStore.getState();useMailStore.getState().addAttachment(request,reference);expect(useMailStore.getState()).toBe(before);
  });
  it('refuses malformed/host references and does not mutate text-only record shape',()=>{
    useMailStore.getState().beginCompose();useMailStore.getState().updateDraft(text);
    useMailStore.getState().addAttachment(owner(),{...reference,path:'C:\\Users\\private.txt'});
    expect(useMailStore.getState().draftInput).toEqual(text);useMailStore.getState().saveDraft();expect(useMailStore.getState().drafts).toEqual([{id:'draft-1',...text}]);
  });
});
describe('Document result entry declaration',()=>{
  it('uses existing FileManager, standard result filters and declared folder navigation',()=>{
    expect(manifest.intentFilters).toContainEqual(expect.objectContaining({action:'ACTION_OPEN_DOCUMENT',type:'*/*',route:'/pick',launchMode:'standard'}));
    const route=NAVIGATION_DECLARATION.routes.find(route=>route.path==='/pick')!;
    expect(route.entryPoint).toBe('deepLink');expect(route.scrollContainers.map(s=>s.name)).toEqual(['main','directory']);
    expect(NAVIGATION_DECLARATION.transitions.find(t=>t.id==='documentPicker.folder.open')).toMatchObject({to:'/pick',searchParams:{path:'string'},mode:'replace'});
  });
});

describe('Documented Intent wildcard matching', () => {
  it.each([
    ['*/*','text/plain',true], ['*/*','image/*',true], ['*/*','application/pdf',true], ['*/*','*/*',true],
    ['*/*',undefined,false], [undefined,'text/plain',true], [undefined,undefined,true],
    ['image/*','image/jpeg',true], ['image/*','text/plain',false], ['text/plain','text/plain',true], ['text/plain','text/html',false],
    ['contact','contact',true], ['image/*',undefined,false],
  ])('matches %s against %s as %s', (filter,intent,expected) => expect(matchesIntentMime(filter as string|undefined,intent as string|undefined)).toBe(expected));
  it('uses the same matching contract for PackageManager and IntentResolver', () => {
    for (const file of ['PackageManagerService.ts','IntentResolver.ts']) {
      const source=readFileSync(new URL('../os/'+file,import.meta.url),'utf8');
      expect(source).toContain("import { matchesIntentMime } from './utils/intentMime'");
      expect(source).not.toContain("filterType.endsWith('/*')");
    }
  });
});
