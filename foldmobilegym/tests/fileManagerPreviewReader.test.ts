import { describe, expect, it, vi } from 'vitest';
import { createFilePreviewReader, type FilePreviewSource, type FilePreviewSnapshot } from '../system/FileManager/utils/previewReader';
import type { FSNode } from '../os/types';
const file: FSNode = {id:'synthetic',name:'source.txt',path:'/sdcard/synthetic/source.txt',parentId:'synthetic-dir',type:'file',storage:'indexeddb',size:5,createdAt:1,modifiedAt:1,mimeType:'text/plain'};
const source = (key='revision-1', patch: Partial<FilePreviewSource> = {}): FilePreviewSource => ({key,file:{...file},writing:false,...patch});
const flush = async () => { for (let i=0;i<12;i++) await Promise.resolve(); };
const deferred = <T,>() => { let resolve!: (value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve}; };
function setup(initial=source(), decode:(text:string)=>string|null=text=>text) {
  let current=initial;
  const events:FilePreviewSnapshot[]=[],read=vi.fn(async (_path:string):Promise<Blob|null>=>new Blob(['FIRST']));
  const reader=createFilePreviewReader({source:()=>current,read,decode,publish:snapshot=>events.push(snapshot)});
  return {reader,read,events,setSource:(next:FilePreviewSource)=>{current=next;}};
}
describe('FileManager source-owned preview reads', () => {
  it('reads an unchanged source only once across repeated refreshes', async () => {
    const x=setup();x.reader.refresh();await flush();x.reader.refresh();x.reader.refresh();await flush();
    expect(x.read).toHaveBeenCalledTimes(1);expect(x.events.at(-1)).toMatchObject({status:'ready',text:'FIRST'});
  });
  it('refreshes changed bytes with unchanged path, ID, size and timestamps', async () => {
    const x=setup();x.reader.refresh();await flush();x.read.mockResolvedValue(new Blob(['OTHER']));x.setSource(source('revision-2'));x.reader.refresh();await flush();
    expect(x.events.at(-1)).toMatchObject({status:'ready',text:'OTHER',key:'revision-2'});expect(x.read).toHaveBeenCalledTimes(2);
  });
  it('clears old content when its source disappears or becomes a directory', async () => {
    const x=setup();x.reader.refresh();await flush();x.setSource(source('deleted',{file:null}));x.reader.refresh();expect(x.events.at(-1)).toMatchObject({status:'error',text:'',file:null});
    x.setSource(source('directory',{file:{...file,type:'directory'}}));x.reader.refresh();expect(x.events.at(-1)).toMatchObject({status:'error',text:''});expect(x.read).toHaveBeenCalledTimes(1);
  });
  it('does not read a half-written source and recovers when the write completes', async () => {
    const x=setup(source('writing',{writing:true}));x.reader.refresh();expect(x.read).not.toHaveBeenCalled();expect(x.events.at(-1)).toMatchObject({status:'loading',text:''});
    x.setSource(source('written'));x.reader.refresh();await flush();expect(x.events.at(-1)).toMatchObject({status:'ready',text:'FIRST'});
  });
  it('does not let an older pending read overwrite a newer result', async () => {
    const old=deferred<Blob|null>(),x=setup();x.read.mockImplementationOnce(()=>old.promise).mockResolvedValue(new Blob(['NEWER']));x.reader.refresh();x.setSource(source('revision-2'));x.reader.refresh();await flush();
    old.resolve(new Blob(['OLDER']));await flush();expect(x.events.at(-1)).toMatchObject({key:'revision-2',status:'ready',text:'NEWER'});expect(x.events.some(e=>e.text==='OLDER')).toBe(false);
  });
  it('rechecks source after a read even before the next observer tick', async () => {
    const pending=deferred<Blob|null>(),x=setup();x.read.mockImplementationOnce(()=>pending.promise).mockResolvedValue(new Blob(['NEWER']));x.reader.refresh();x.setSource(source('replacement',{file:{...file,id:'replacement'}}));pending.resolve(new Blob(['OLDER']));await flush();
    expect(x.events.at(-1)).toMatchObject({key:'replacement',status:'ready',text:'NEWER'});expect(x.events.some(e=>e.text==='OLDER')).toBe(false);
  });
  it('rechecks source after asynchronous text decoding', async () => {
    const pending=deferred<string>(),x=setup(),blob=new Blob(['OLDER']);vi.spyOn(blob,'text').mockReturnValue(pending.promise);x.read.mockResolvedValueOnce(blob).mockResolvedValue(new Blob(['NEWER']));x.reader.refresh();await flush();
    x.setSource(source('revision-2'));pending.resolve('OLDER');await flush();expect(x.events.at(-1)).toMatchObject({key:'revision-2',status:'ready',text:'NEWER'});
  });
  it('ignores pending completion and refresh after disposal', async () => {
    const pending=deferred<Blob|null>(),x=setup();x.read.mockReturnValue(pending.promise);x.reader.refresh();const count=x.events.length;x.reader.dispose();pending.resolve(new Blob(['OLDER']));await flush();x.reader.refresh();expect(x.events).toHaveLength(count);
  });
  it('turns failed reads and decoding errors into a content-free error state', async () => {
    const x=setup();x.read.mockRejectedValueOnce(new Error('synthetic read failure'));x.reader.refresh();await flush();expect(x.events.at(-1)).toMatchObject({status:'error',text:''});
    const y=setup(),blob=new Blob(['x']);vi.spyOn(blob,'text').mockRejectedValue(new Error('synthetic decode failure'));y.read.mockResolvedValue(blob);y.reader.refresh();await flush();expect(y.events.at(-1)).toMatchObject({status:'error',text:''});
  });
  it('accepts an empty text file but does not fabricate unsupported PDF text', async () => {
    const x=setup();x.read.mockResolvedValue(new Blob(['']));x.reader.refresh();await flush();expect(x.events.at(-1)).toMatchObject({status:'ready',text:''});
    const y=setup(source(),()=>null);y.reader.refresh();await flush();expect(y.events.at(-1)).toMatchObject({status:'error',text:''});
  });
  it('treats a missing blob as unavailable without leaking the previous body', async () => {
    const x=setup();x.read.mockResolvedValue(null);x.reader.refresh();await flush();expect(x.events.at(-1)).toMatchObject({status:'error',text:''});
  });
});
