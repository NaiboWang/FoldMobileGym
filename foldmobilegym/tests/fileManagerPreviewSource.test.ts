import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../os/FileSystemService',()=>({getNode:vi.fn(),getFileContentToken:vi.fn()}));
import * as FileSystem from '../os/FileSystemService';
import { captureFilePreviewSource } from '../system/FileManager/utils/previewSource';
import type { FSNode } from '../os/types';
const node:FSNode={id:'row-source',name:'source.svg',path:'/sdcard/source.svg',parentId:'root',type:'file',storage:'indexeddb',size:20,createdAt:1,modifiedAt:1,mimeType:'image/svg+xml'};
beforeEach(()=>{vi.mocked(FileSystem.getNode).mockReturnValue({...node});vi.mocked(FileSystem.getFileContentToken).mockReturnValue(0);});
describe('FileManager shared preview source snapshot',()=>{
 it('preserves stable keys but detects frozen-metadata content changes',()=>{
  const first=captureFilePreviewSource(node.path);expect(captureFilePreviewSource(node.path).key).toBe(first.key);vi.mocked(FileSystem.getFileContentToken).mockReturnValue(1);expect(captureFilePreviewSource(node.path).key).not.toBe(first.key);
 });
 it('copies metadata instead of retaining a mutable source object',()=>{
  const live={...node};vi.mocked(FileSystem.getNode).mockReturnValue(live);const first=captureFilePreviewSource(node.path);live.size=99;expect(first.file?.size).toBe(20);expect(captureFilePreviewSource(node.path).key).not.toBe(first.key);
 });
 it('does not present a replacement node under an old row identity',()=>{
  vi.mocked(FileSystem.getNode).mockReturnValue({...node,id:'replacement'});expect(captureFilePreviewSource(node.path,node.id).file).toBeNull();expect(captureFilePreviewSource(node.path,'replacement').file?.id).toBe('replacement');
 });
 it('retains explicit blank-ID rejection and distinct path/identity keys',()=>{
  expect(captureFilePreviewSource(node.path,'').file).toBeNull();expect(captureFilePreviewSource(node.path,node.id).key).not.toBe(captureFilePreviewSource(node.path).key);
 });
 it('identifies pending writes and missing sources without inferring image data',()=>{
  vi.mocked(FileSystem.getFileContentToken).mockReturnValue(null);expect(captureFilePreviewSource(node.path).writing).toBe(true);vi.mocked(FileSystem.getNode).mockReturnValue(null);expect(captureFilePreviewSource(node.path).file).toBeNull();expect(captureFilePreviewSource('/other').key).not.toBe(captureFilePreviewSource(node.path).key);
 });
});
