import {describe,expect,it} from 'vitest';
import {fileContentToken,beginFileContentWrite,endFileContentWrite} from '../os/fileContentRevision';
describe('volatile file-byte write evidence',()=>{
 it('changes even when an in-place write leaves all simulated timestamps and sizes equal',()=>{
  const node={id:'real-id',size:12,modifiedAt:100};const before=fileContentToken(node);beginFileContentWrite(node);expect(fileContentToken(node)).toBeNull();endFileContentWrite(node);expect(fileContentToken(node)).not.toBe(before);expect(node).toEqual({id:'real-id',size:12,modifiedAt:100});
 });
 it('keeps concurrent writes unavailable until every completion',()=>{
  const node={};beginFileContentWrite(node);beginFileContentWrite(node);endFileContentWrite(node);expect(fileContentToken(node)).toBeNull();endFileContentWrite(node);expect(fileContentToken(node)).not.toBeNull();
 });
 it('does not add revision fields to persistent nodes or share evidence with a replacement object',()=>{
  const node={id:'same'};beginFileContentWrite(node);endFileContentWrite(node);expect(fileContentToken({...node})).toBe(0);expect(Object.keys(node)).toEqual(['id']);
 });
});
