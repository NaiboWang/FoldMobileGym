import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
beforeEach(()=>vi.resetModules());afterEach(()=>vi.unstubAllGlobals());
const response=(value:unknown,ok=true)=>({ok,status:ok?200:503,json:async()=>value});
describe('X volatile loader availability and retry',()=>{
 it('starts idle with stable snapshots and no persistent data invention',async()=>{
  const loader=await import('../apps/X/data/loader');expect(loader.getXLoadStatus()).toEqual({users:'idle',posts:'idle',replies:'idle'});expect(loader.getXLoadStatus()).toBe(loader.getXLoadStatus());expect(loader.getXBaseDataset().posts).toEqual([]);
 });
 it('tracks empty successful datasets as ready and serves them from cache',async()=>{
  const fetch=vi.fn(async(url:any)=>response(String(url).includes('posts.json')?[]:{}));vi.stubGlobal('fetch',fetch);
  const loader=await import('../apps/X/data/loader');await loader.preload();await loader.loadReplies();expect(loader.getXLoadStatus()).toEqual({users:'ready',posts:'ready',replies:'ready'});
  await loader.preload();await loader.loadReplies();expect(fetch).toHaveBeenCalledTimes(3);
 });
 it('keeps failed posts distinct from empty success and retries the same authoritative source',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(response(null,false)).mockResolvedValueOnce(response([]));vi.stubGlobal('fetch',fetch);
  const loader=await import('../apps/X/data/loader');await expect(loader.loadPosts()).rejects.toThrow('503');expect(loader.getXLoadStatus().posts).toBe('error');expect(loader.getXBaseDataset().posts).toEqual([]);
  await loader.loadPosts();expect(loader.getXLoadStatus().posts).toBe('ready');expect(fetch.mock.calls[0][0]).toBe(fetch.mock.calls[1][0]);
 });
 it('publishes pending and error before retry succeeds, without unhandled async ownership',async()=>{
  let reject!:(error:Error)=>void;const fetch=vi.fn(()=>new Promise((_,r)=>{reject=r}));vi.stubGlobal('fetch',fetch);
  const loader=await import('../apps/X/data/loader'),states:string[]=[];const off=loader.subscribeXLoadStatus(()=>states.push(loader.getXLoadStatus().replies));
  const pending=loader.loadReplies();expect(loader.getXLoadStatus().replies).toBe('loading');const checked=expect(pending).rejects.toThrow('local failure');reject(new Error('local failure'));await checked;off();expect(states).toEqual(['loading','error']);
 });
 it('shares in-flight requests and does not corrupt the base snapshot on malformed data',async()=>{
  let finish!:(value:unknown)=>void;const fetch=vi.fn(()=>new Promise(resolve=>{finish=resolve}));vi.stubGlobal('fetch',fetch);
  const loader=await import('../apps/X/data/loader');const a=loader.loadPosts(),b=loader.loadPosts();expect(fetch).toHaveBeenCalledTimes(1);finish(response({not:'an array'}));await expect(a).rejects.toThrow('Invalid posts');await expect(b).rejects.toThrow('Invalid posts');expect(loader.getXBaseDataset().posts).toEqual([]);expect(loader.getXLoadStatus().posts).toBe('error');
 });
 it('isolates loading observers from the existing batched world-data subscription',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(url:any)=>response(String(url).includes('posts.json')?[]:{})));
  const loader=await import('../apps/X/data/loader'),base=vi.fn(),status=vi.fn();const off=loader.subscribeBaseDataset(base),offStatus=loader.subscribeXLoadStatus(status);
  await loader.preload();expect(base).toHaveBeenCalledTimes(1);expect(status).toHaveBeenCalledTimes(4);off();offStatus();await loader.loadReplies();expect(base).toHaveBeenCalledTimes(1);expect(status).toHaveBeenCalledTimes(4);
 });
 it('rejects invalid reply roots rather than caching a false ready/empty world',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>response({root:'not a reply array'})));const loader=await import('../apps/X/data/loader');await expect(loader.loadReplies()).rejects.toThrow('Invalid replies');expect(loader.getXLoadStatus().replies).toBe('error');expect(loader.getXBaseDataset().replies).toEqual({});
 });
});
