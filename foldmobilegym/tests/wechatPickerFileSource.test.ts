import {beforeEach,describe,expect,it,vi} from 'vitest';
import type {FSNode} from '../os/types';
const fs=vi.hoisted(()=>({node:null as FSNode|null,bytes:new Blob(['first']),revision:0,read:vi.fn()}));
vi.mock('../os/FileSystemService',()=>({getNode:(path:string)=>fs.node?.path===path?fs.node:null,getFileContentToken:()=>fs.revision,readFile:fs.read}));
import {capturePickerIdentity,capturePickerFile,sourceIsCurrent,validatePickerFiles} from '../apps/Wechat/utils/pickerFileSource';
const node=()=>({id:'original',name:'original.txt',type:'file',path:'/sdcard/original.txt',parentId:'parent',size:5,mimeType:'text/plain',createdAt:100,modifiedAt:100,storage:'memory'}) as FSNode;
describe('WeChat exact picker file identity and bytes',()=>{
 beforeEach(()=>{fs.node=node();fs.bytes=new Blob(['first']);fs.revision=0;fs.read.mockReset().mockImplementation(async()=>fs.bytes);});
 it('uses real nonempty/empty file bytes rather than a URI or invented size',async()=>{
  const source=capturePickerFile(fs.node!.path,false)!;expect(await validatePickerFiles([source])).toBe(true);fs.node!.size=0;fs.bytes=new Blob([]);const empty=capturePickerFile(fs.node!.path,false)!;expect(await validatePickerFiles([empty])).toBe(true);
 });
 it('rejects same-path identity replacement and immutable-metadata changes',async()=>{
  const source=capturePickerFile(fs.node!.path,false)!;await source.ready;fs.node={...fs.node!,id:'replacement'};expect(await validatePickerFiles([source])).toBe(false);
  fs.node=node();const second=capturePickerFile(fs.node.path,false)!;await second.ready;fs.node.size=7;expect(sourceIsCurrent(second)).toBe(false);
 });
 it('rejects a frozen-time equal-size in-place byte write using its real revision',async()=>{
  const source=capturePickerFile(fs.node!.path,false)!;await source.ready;fs.bytes=new Blob(['other']);fs.revision++;expect(await validatePickerFiles([source])).toBe(false);
 });
 it('rejects changed bytes even if a different storage context left local metadata/version unchanged',async()=>{
  const source=capturePickerFile(fs.node!.path,false)!;await source.ready;fs.bytes=new Blob(['other']);expect(await validatePickerFiles([source])).toBe(false);
 });
 it('rejects selection from a stale rendered view before a new content capture',()=>{
  const visible=capturePickerIdentity(fs.node!.path)!;fs.revision++;expect(capturePickerFile(fs.node!.path,false,fs.node!.id,visible)).toBeNull();
 });
 it('does not partially accept a valid item when another source is unavailable',async()=>{
  const source=capturePickerFile(fs.node!.path,false)!;await source.ready;fs.read.mockResolvedValueOnce(null);expect(await validatePickerFiles([source])).toBe(false);expect(await validatePickerFiles([])).toBe(false);
 });
 it('rejects a source changed while an asynchronous read is still outstanding',async()=>{
  let resolve!:(value:Blob)=>void;fs.read.mockReturnValueOnce(new Promise<Blob>(yes=>{resolve=yes;}));const source=capturePickerFile(fs.node!.path,false)!;fs.node!.mimeType='application/octet-stream';resolve(fs.bytes);expect(await source.ready).toBeNull();expect(await validatePickerFiles([source])).toBe(false);
 });
});
