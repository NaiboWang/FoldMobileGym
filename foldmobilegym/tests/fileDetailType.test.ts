import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {getFileDetailType} from '../system/FileManager/utils/fileDetailType';
const labels={directory:'Folder',unavailable:'Type not provided'};
describe('FileManager detail metadata type',()=>{
 it('identifies directories even if an irrelevant MIME is supplied',()=>{
  expect(getFileDetailType({type:'directory',mimeType:'text/plain'},labels)).toBe('Folder');
 });
 it.each(['application/pdf','text/plain','image/jpeg'])('retains declared MIME %s',mimeType=>{
  expect(getFileDetailType({type:'file',mimeType},labels)).toBe(mimeType);
 });
 it.each([undefined,'','   '])('explicitly marks absent type %j',mimeType=>{
  expect(getFileDetailType({type:'file',mimeType},labels)).toBe('Type not provided');
 });
 it('normalizes surrounding whitespace only',()=>{
  expect(getFileDetailType({type:'file',mimeType:' application/pdf '},labels)).toBe('application/pdf');
 });
 it('renders types and reuses existing file icons without replacing folder artwork',()=>{
  const source=readFileSync(new URL('../system/FileManager/components/Dialog.tsx',import.meta.url),'utf8');
  expect(source).toContain('data-file-detail-type');
  expect(source).toContain('const DetailIcon = getFileIcon(file)');
  expect(source).toContain('isFolder ? <svg');
  expect(source).toContain('<DetailIcon size={80}');
 });
});
