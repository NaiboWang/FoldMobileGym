import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../os/FileSystemService',()=>({getNode:vi.fn(),getFileUriAsync:vi.fn()}));
import * as FileSystem from '../os/FileSystemService';
import { appendNoteImage, cloneNoteImages, sameNoteImages, validNoteImages, type NoteImage } from '../system/Notes/noteImages';
import { createTextHistory } from '../system/Notes/textHistory';
import { persistEditorText } from '../system/Notes/editorPersistence';
import { useNotesStore } from '../system/Notes/state';
import { loadNoteImage, resolveNoteImageNode } from '../system/Notes/utils/imageSource';
import type { FSNode } from '../os/types';
const source={id:'media-1',path:'/sdcard/Pictures/测试%2F.jpg',createdAt:100};
const image:NoteImage={id:'image-1',source};
const node:FSNode={...source,name:'测试%2F.jpg',parentId:'pictures',type:'file',size:100,mimeType:'image/jpeg',storage:'preset',modifiedAt:100};
const initial=useNotesStore.getState();
beforeEach(()=>{useNotesStore.setState(initial,true);vi.mocked(FileSystem.getNode).mockReset().mockReturnValue({...node});vi.mocked(FileSystem.getFileUriAsync).mockReset().mockResolvedValue('/sdcard/Pictures/source.jpg');});
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
describe('Notes image block identity/data',()=>{
 it('keeps independent block IDs for intentionally inserting one source more than once',()=>{
  const first=appendNoteImage(undefined,source,'same');const second=appendNoteImage(first,source,'same');
  expect(second.map(image=>image.id)).toEqual(['same','same-1']);expect(second[0].source).toEqual(second[1].source);expect(first).toHaveLength(1);
 });
 it('allocates against a suffix chain without mutating the selected source',()=>{
  const first=[{...image,id:'repeat'},{...image,id:'repeat-1'}];expect(appendNoteImage(first,source,'repeat')[2].id).toBe('repeat-2');expect(source).toEqual(image.source);
 });
 it('clones only stable reference fields, not a live mutable payload object',()=>{
  const copied=cloneNoteImages([image]);copied[0].source.path='changed';expect(image.source.path).toBe(source.path);
  expect(Object.keys(copied[0])).toEqual(['id','source']);expect(Object.keys(copied[0].source)).toEqual(['id','path','createdAt']);
 });
 it.each([null,{},[{id:'x',source:{path:'C:\\private.jpg'}}],[image,image]])('rejects malformed/duplicate block list %#',value=>expect(validNoteImages(value)).toBe(false));
 it('compares order, block ID and immutable source incarnation',()=>{
  expect(sameNoteImages(undefined,[])).toBe(true);expect(sameNoteImages([image],cloneNoteImages([image]))).toBe(true);
  expect(sameNoteImages([image],[{...image,id:'other'}])).toBe(false);expect(sameNoteImages([image],[{...image,source:{...source,createdAt:101}}])).toBe(false);
 });
 it('publishes an image-only new note but not a truly blank editor',()=>{
  const add=vi.fn(()=>({id:'new'})),update=vi.fn();const draft={title:'',content:'',folderId:'unfiled',isNew:true,isTrashed:false};
  expect(persistEditorText(draft,null,add,update)).toBeNull();expect(persistEditorText({...draft,images:[image]},null,add,update)).toBe('new');
  expect(add).toHaveBeenCalledExactlyOnceWith({title:'',content:'',folderId:'unfiled',images:[image]});
 });
 it('undoing image-only content to blank retains the existing persistent ID',()=>{
  const add=vi.fn(),update=vi.fn();expect(persistEditorText({title:'',content:'',folderId:'unfiled',images:[],isNew:true,isTrashed:false},'created',add,update)).toBe('created');expect(add).not.toHaveBeenCalled();expect(update).toHaveBeenCalledWith('created',{title:'',content:'',folderId:'unfiled',images:[]});
 });
 it('keeps plain note record shape identical and computes image metadata only for real blocks',()=>{
  const plain=useNotesStore.getState().addNote({title:'Plain',content:'Unchanged'});expect(plain).not.toHaveProperty('images');expect(plain).not.toHaveProperty('hasImage');
  const picture=useNotesStore.getState().addNote({title:'Picture',images:[image]});expect(picture.images).toEqual([image]);expect(picture.hasImage).toBe(true);
  useNotesStore.getState().updateNote(picture.id,{content:'caption'});expect(useNotesStore.getState().notes.find(n=>n.id===picture.id)?.images).toEqual([image]);
  useNotesStore.getState().updateNote(picture.id,{images:[]});expect(useNotesStore.getState().notes.find(n=>n.id===picture.id)).toMatchObject({content:'caption',images:[],hasImage:false});
 });
 it('never aliases provided image arrays into persisted records or recreates a missing note',()=>{
  const images=cloneNoteImages([image]);const note=useNotesStore.getState().addNote({images});images[0].source.path='mutated';expect(note.images?.[0].source.path).toBe(source.path);
  const before=useNotesStore.getState();useNotesStore.getState().updateNote('missing',{images:[image]});expect(useNotesStore.getState().notes).toEqual(before.notes);
 });
 it('rejects invalid media updates without rewriting a valid record',()=>{
  const note=useNotesStore.getState().addNote({content:'Keep'});const before=useNotesStore.getState();useNotesStore.getState().updateNote(note.id,{images:[{...image,source:{...source,path:'/etc/private'}}]});expect(useNotesStore.getState()).toBe(before);
 });
});
describe('Notes mixed text/image undo truth',()=>{
 const selection={field:'content' as const,start:0,end:0};
 it('undoes/redoes insertion and removal as real ordered transactions',()=>{
  const h=createTextHistory({title:'Title',content:'Caption'});h.record({title:'Title',content:'Caption',images:[image]},selection,selection,{inputType:'insertImage',time:0});
  h.record({title:'Title',content:'Edited caption',images:[image]},selection,selection,{inputType:'insertText',time:1});
  h.record({title:'Title',content:'Edited caption',images:[]},selection,selection,{inputType:'removeImage',time:2});
  expect(h.undo()).toMatchObject({content:'Edited caption',images:[image]});expect(h.undo()).toMatchObject({content:'Caption',images:[image]});expect(h.undo()?.images).toBeUndefined();
  expect(h.redo()?.images).toEqual([image]);expect(h.redo()?.content).toBe('Edited caption');expect(h.redo()?.images).toEqual([]);
 });
 it('new image insertion after Undo replaces only the redo branch',()=>{
  const h=createTextHistory({title:'',content:'',images:[]});h.record({title:'',content:'',images:[image]},selection,selection,{inputType:'insertImage',time:0});h.undo();
  const other={...image,id:'image-2'};h.record({title:'',content:'',images:[other]},selection,selection,{inputType:'insertImage',time:1});expect(h.canRedo()).toBe(false);expect(h.getSnapshot().images).toEqual([other]);
 });
 it('history snapshots and caller payloads cannot mutate stored old image identities',()=>{
  const images=cloneNoteImages([image]),h=createTextHistory({title:'',content:'',images});images[0].source.path='changed';expect(h.getSnapshot().images?.[0].source.path).toBe(source.path);
  const snapshot=h.getSnapshot();snapshot.images![0].source.id='wrong';expect(h.getSnapshot().images?.[0].source.id).toBe(source.id);
 });
});
describe('Actual source decoding, cancellation and identity',()=>{
 function imageStub(mode:'success'|'error'|'pending'){
  vi.stubGlobal('Image',class{naturalWidth=100;naturalHeight=75;onload:(()=>void)|null=null;onerror:(()=>void)|null=null;set src(_uri:string){if(mode!=='pending')queueMicrotask(()=>{if(mode==='success')this.onload?.();else this.onerror?.();});}removeAttribute(_name:string){}});
 }
 it('rejects malformed source identity before file access',()=>{expect(resolveNoteImageNode(null as never)).toBeNull();expect(FileSystem.getNode).not.toHaveBeenCalled();});
 it('accepts only the selected readable image with matching id/path/incarnation',async()=>{imageStub('success');expect(resolveNoteImageNode(source)).toEqual(node);expect(await loadNoteImage(source,new AbortController().signal)).toBe('/sdcard/Pictures/source.jpg');});
 it.each(['id','path','createdAt','mimeType'] as const)('rejects a different source %s before URI access',async key=>{imageStub('success');const changed={...node,[key]:key==='createdAt'?101:key==='mimeType'?'text/plain':'different'};vi.mocked(FileSystem.getNode).mockReturnValue(changed as FSNode);expect(await loadNoteImage(source,new AbortController().signal)).toBeNull();expect(FileSystem.getFileUriAsync).not.toHaveBeenCalled();});
 it('rejects deleted files, failed URI access and non-decodable image bytes',async()=>{imageStub('error');expect(await loadNoteImage(source,new AbortController().signal)).toBeNull();vi.mocked(FileSystem.getNode).mockReturnValue(null);expect(resolveNoteImageNode(source)).toBeNull();vi.mocked(FileSystem.getNode).mockReturnValue(node);vi.mocked(FileSystem.getFileUriAsync).mockRejectedValue(Error('read failure'));expect(await loadNoteImage(source,new AbortController().signal)).toBeNull();});
 it('revalidates source identity after asynchronous URI resolution',async()=>{imageStub('success');vi.mocked(FileSystem.getFileUriAsync).mockImplementation(async()=>{vi.mocked(FileSystem.getNode).mockReturnValue({...node,id:'replacement'});return'/source.jpg';});expect(await loadNoteImage(source,new AbortController().signal)).toBeNull();});
 it('aborts queued decode work without a late success',async()=>{imageStub('pending');const abort=new AbortController(),pending=loadNoteImage(source,abort.signal);await Promise.resolve();abort.abort();expect(await pending).toBeNull();});
 it('times out a never-completing decoder without accepting a substitute image',async()=>{vi.useFakeTimers();imageStub('pending');const pending=loadNoteImage(source,new AbortController().signal);await Promise.resolve();await vi.advanceTimersByTimeAsync(8000);expect(await pending).toBeNull();});
});
