import { describe, expect, it, vi } from 'vitest';
import { createFileUriCache } from '../os/fileUriCache';
const deferred=<T,>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {resolve,promise};};
function setup(){
 const node={id:'one',type:'file'},nodes=new Map([['/one',node]]),versions=new Map<object,number|null>([[node,0]]);
 let created=0;
 const read=vi.fn(async (_path:string):Promise<Blob|null>=>new Blob(['source'])),create=vi.fn((_blob:Blob)=>`blob:owned-${++created}`),revoke=vi.fn();
 const cache=createFileUriCache({lookup:p=>nodes.get(p)??null,revision:n=>versions.get(n)??null,read,create,revoke});
 return {node,nodes,versions,read,create,revoke,cache};
}
describe('file source-owned URI cache',()=>{
 it('shares a current owned URI across async and synchronous reads',async()=>{
  const x=setup();const uri=await x.cache.resolve('/one');expect(uri).toBe('blob:owned-1');expect(x.cache.sync('/one')).toBe(uri);expect(await x.cache.resolve('/one')).toBe(uri);expect(x.read).toHaveBeenCalledTimes(1);
 });
 it('publishes one URL for concurrent reads of the same source',async()=>{
  const x=setup(),a=deferred<Blob|null>(),b=deferred<Blob|null>();x.read.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
  const first=x.cache.resolve('/one'),second=x.cache.resolve('/one');a.resolve(new Blob(['a']));b.resolve(new Blob(['a']));
  const uris=await Promise.all([first,second]);expect(uris[0]).toBe(uris[1]);expect(x.create).toHaveBeenCalledTimes(1);
 });
 it('rejects a rewrite while its old bytes are being read',async()=>{
  const x=setup(),pending=deferred<Blob|null>();x.read.mockReturnValueOnce(pending.promise);const old=x.cache.resolve('/one');x.versions.set(x.node,1);pending.resolve(new Blob(['old']));
  expect(await old).toBeNull();expect(x.create).not.toHaveBeenCalled();expect(await x.cache.resolve('/one')).not.toBeNull();
 });
 it('rejects a different node with the same ID and revision',async()=>{
  const x=setup(),pending=deferred<Blob|null>();x.read.mockReturnValueOnce(pending.promise);const old=x.cache.resolve('/one');const replacement={...x.node};x.nodes.set('/one',replacement);x.versions.set(replacement,0);pending.resolve(new Blob(['old']));
  expect(await old).toBeNull();expect(x.create).not.toHaveBeenCalled();
 });
 it('rejects a deleted source without allocating a URL',async()=>{
  const x=setup(),pending=deferred<Blob|null>();x.read.mockReturnValue(pending.promise);const old=x.cache.resolve('/one');x.nodes.delete('/one');pending.resolve(new Blob(['old']));expect(await old).toBeNull();expect(x.create).not.toHaveBeenCalled();
 });
 it('rejects a pending old path after a move but can resolve the same node at its new path',async()=>{
  const x=setup(),pending=deferred<Blob|null>();x.read.mockReturnValueOnce(pending.promise);const old=x.cache.resolve('/one');x.nodes.delete('/one');x.nodes.set('/moved',x.node);pending.resolve(new Blob(['same bytes']));
  expect(await old).toBeNull();expect(x.cache.sync('/one')).toBeNull();expect(await x.cache.resolve('/moved')).not.toBeNull();
 });
 it('does not revoke or overwrite a newer URL when an old read finishes',async()=>{
  const x=setup(),pending=deferred<Blob|null>();x.read.mockReturnValueOnce(pending.promise);const old=x.cache.resolve('/one');x.versions.set(x.node,1);const current=await x.cache.resolve('/one');pending.resolve(new Blob(['old']));
  expect(await old).toBeNull();expect(x.cache.sync('/one')).toBe(current);expect(x.revoke).not.toHaveBeenCalled();expect(x.create).toHaveBeenCalledTimes(1);
 });
 it('does not return or read a half-written source',async()=>{
  const x=setup();await x.cache.resolve('/one');x.versions.set(x.node,null);expect(x.cache.sync('/one')).toBeNull();expect(await x.cache.resolve('/one')).toBeNull();expect(x.read).toHaveBeenCalledTimes(1);
  x.versions.set(x.node,1);await x.cache.resolve('/one');expect(x.revoke).toHaveBeenCalledTimes(1);expect(x.create).toHaveBeenCalledTimes(2);
 });
 it('revokes only the requested owned entry and preserves other entries',async()=>{
  const x=setup(),other={id:'two',type:'file'};x.nodes.set('/two',other);x.versions.set(other,0);const one=await x.cache.resolve('/one'),two=await x.cache.resolve('/two');x.cache.clear('one');x.cache.clear('one');
  expect(x.revoke.mock.calls).toEqual([[one]]);expect(x.cache.sync('/two')).toBe(two);
 });
 it('revokes all current owned entries exactly once',async()=>{
  const x=setup(),other={id:'two',type:'file'};x.nodes.set('/two',other);x.versions.set(other,0);await x.cache.resolve('/one');await x.cache.resolve('/two');x.cache.clearAll();x.cache.clearAll();expect(x.revoke).toHaveBeenCalledTimes(2);expect(x.cache.sync('/one')).toBeNull();
 });
 it('does not repopulate the cache after clearAll from a pending read',async()=>{
  const x=setup(),pending=deferred<Blob|null>();x.read.mockReturnValue(pending.promise);const old=x.cache.resolve('/one');x.cache.clearAll();pending.resolve(new Blob(['old']));expect(await old).toBeNull();expect(x.create).not.toHaveBeenCalled();
 });
 it('ignores missing and non-file sources',async()=>{
  const x=setup();x.node.type='directory';expect(await x.cache.resolve('/one')).toBeNull();expect(x.cache.sync('/missing')).toBeNull();expect(x.read).not.toHaveBeenCalled();
 });
 it('does not cache missing bytes and retains existing rejection semantics',async()=>{
  const x=setup();x.read.mockResolvedValueOnce(null);expect(await x.cache.resolve('/one')).toBeNull();x.read.mockRejectedValueOnce(new Error('synthetic failure'));await expect(x.cache.resolve('/one')).rejects.toThrow('synthetic failure');expect(x.create).not.toHaveBeenCalled();
 });
});
