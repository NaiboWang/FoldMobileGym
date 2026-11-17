import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
beforeEach(()=>{vi.resetModules();vi.doMock('../os/PackageManagerService',()=>{throw new Error('Single-store import must not enumerate every app manifest/icon');});});
afterEach(()=>{vi.doUnmock('../os/PackageManagerService');vi.unstubAllGlobals();vi.resetModules();});
describe('single-app state creation dependency boundary',()=>{
  it('loads the actual benchmark controller without GUI package discovery',async()=>{vi.stubGlobal('window',{addEventListener:vi.fn()});expect((await import('../foldagent_benchmark')).FoldAgentBenchmarkController).toBeTypeOf('function');});
  it('creates and reads an actual volatile store without package discovery',async()=>{
    const core=await import('../os/createAppStore');const store=core.createVolatileAppStore('owned_boundary',{value:17});
    expect(core.getStore('owned_boundary')).toBe(store);expect(store.getState().value).toBe(17);
  });
  it.each([
    ['Alipay',()=>import('../apps/Alipay/state')],
    ['Map',()=>import('../apps/Map/state')],
    ['Notes',()=>import('../system/Notes/state')],
    ['RedBook',()=>import('../apps/RedBook/state')],
  ] as const)('imports real %s state without global package discovery',async(_name,load)=>{expect(await load()).toBeDefined();});
});
