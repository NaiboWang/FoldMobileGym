import { describe, expect, it, vi } from 'vitest';
import { createFileImageReader, type FileImageSnapshot } from '../system/FileManager/utils/imageReader';
import type { FilePreviewSource } from '../system/FileManager/utils/previewReader';
import type { FSNode } from '../os/types';
const node:FSNode={id:'image-source',name:'source.svg',path:'/sdcard/source.svg',parentId:'root',type:'file',storage:'indexeddb',size:20,createdAt:1,modifiedAt:1,mimeType:'image/svg+xml'};
const source=(key='one',patch:Partial<FilePreviewSource>={}):FilePreviewSource=>({key,file:{...node},writing:false,...patch});
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const deferred=<T,>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};};
function setup(initial=source()){
 let current=initial;const events:FileImageSnapshot[]=[],resolve=vi.fn(async(_path:string):Promise<string|null>=>'blob:image');
 const reader=createFileImageReader({source:()=>current,resolve,publish:value=>events.push(value)});
 return {reader,resolve,events,setSource:(next:FilePreviewSource)=>{current=next;}};
}
describe('FileManager image source/decoder ownership',()=>{
 it('keeps the URI loading until the actual lazy image reports successful decode',async()=>{
  const x=setup();x.reader.refresh();await flush();expect(x.events.at(-1)).toMatchObject({status:'loading',uri:'blob:image'});
  x.reader.imageResult('one','blob:image',true);expect(x.events.at(-1)).toMatchObject({status:'ready',uri:'blob:image'});const count=x.events.length;x.reader.refresh();x.reader.imageResult('one','blob:image',true);expect(x.events).toHaveLength(count);expect(x.resolve).toHaveBeenCalledTimes(1);
 });
 it('clears failed pixels and ignores an old late success callback',async()=>{
  const x=setup();x.reader.refresh();await flush();x.reader.imageResult('one','blob:image',true);x.reader.imageResult('one','blob:image',false);
  expect(x.events.at(-1)).toMatchObject({status:'error',uri:null});x.reader.imageResult('one','blob:image',true);expect(x.events.at(-1)?.status).toBe('error');
 });
 it('recovers from failed pixels after a new content revision',async()=>{
  const x=setup();x.reader.refresh();await flush();x.reader.imageResult('one','blob:image',false);x.setSource(source('two'));x.reader.refresh();await flush();x.reader.imageResult('two','blob:image',true);expect(x.events.at(-1)).toMatchObject({key:'two',status:'ready'});
 });
 it('does not let an old URI request overwrite the newer source',async()=>{
  const old=deferred<string|null>(),x=setup();x.resolve.mockReturnValueOnce(old.promise).mockResolvedValue('blob:new');x.reader.refresh();x.setSource(source('two'));x.reader.refresh();await flush();x.reader.imageResult('two','blob:new',true);old.resolve('blob:old');await flush();expect(x.events.at(-1)).toMatchObject({key:'two',status:'ready',uri:'blob:new'});
 });
 it('detects a changed source before the next observer tick',async()=>{
  const old=deferred<string|null>(),x=setup();x.resolve.mockReturnValueOnce(old.promise).mockResolvedValue('blob:new');x.reader.refresh();x.setSource(source('two'));old.resolve('blob:old');await flush();expect(x.events.at(-1)).toMatchObject({key:'two',status:'loading',uri:'blob:new'});expect(x.events.some(e=>e.uri==='blob:old')).toBe(false);
 });
 it('rejects stale decoder callbacks even if the URI is reused',async()=>{
  const x=setup();x.reader.refresh();await flush();x.setSource(source('two'));x.reader.refresh();await flush();x.reader.imageResult('one','blob:image',false);x.reader.imageResult('two','blob:image',true);expect(x.events.at(-1)).toMatchObject({key:'two',status:'ready',uri:'blob:image'});
 });
 it('refreshes rather than committing an event after source revocation',async()=>{
  const x=setup();x.reader.refresh();await flush();x.setSource(source('deleted',{file:null}));x.reader.imageResult('one','blob:image',true);expect(x.events.at(-1)).toMatchObject({status:'error',uri:null,file:null});
 });
 it('does not resolve missing, mismatched or half-written sources',async()=>{
  const x=setup(source('missing',{file:null}));x.reader.refresh();expect(x.events.at(-1)).toMatchObject({status:'error',uri:null});x.setSource(source('writing',{writing:true}));x.reader.refresh();expect(x.events.at(-1)).toMatchObject({status:'loading',uri:null});expect(x.resolve).not.toHaveBeenCalled();x.setSource(source('done'));x.reader.refresh();await flush();expect(x.resolve).toHaveBeenCalledTimes(1);
 });
 it('catches URI failures and treats null as unavailable',async()=>{
  const x=setup();x.resolve.mockRejectedValueOnce(new Error('synthetic read failure'));x.reader.refresh();await flush();expect(x.events.at(-1)).toMatchObject({status:'error',uri:null});x.setSource(source('two'));x.resolve.mockResolvedValue(null);x.reader.refresh();await flush();expect(x.events.at(-1)).toMatchObject({status:'error',uri:null});
 });
 it('retries an unchanged failed source on foreground but never spams a ready source',async()=>{
  const x=setup();x.reader.refresh();await flush();x.reader.imageResult('one','blob:image',false);x.reader.refresh();expect(x.resolve).toHaveBeenCalledTimes(1);x.reader.retry();await flush();x.reader.imageResult('one','blob:image',true);x.reader.retry();await flush();expect(x.resolve).toHaveBeenCalledTimes(2);expect(x.events.at(-1)?.status).toBe('ready');
 });
 it('does not publish or accept decoder events after disposal',async()=>{
  const old=deferred<string|null>(),x=setup();x.resolve.mockReturnValue(old.promise);x.reader.refresh();const count=x.events.length;x.reader.dispose();old.resolve('blob:old');await flush();x.reader.imageResult('one','blob:old',true);x.reader.retry();expect(x.events).toHaveLength(count);
 });
});
