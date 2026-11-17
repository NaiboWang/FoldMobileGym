import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
let setPackages: (ids: readonly string[]) => void;
beforeEach(async()=>{
  vi.resetModules();const membership=await import('../os/installedPackageIds');setPackages=membership.setInstalledPackageIds;setPackages([]);
  const data=new Map<string,string>();
  vi.stubGlobal('localStorage',{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);},removeItem:(key:string)=>{data.delete(key);},clear:()=>data.clear()});
  vi.doMock('../os/PackageManagerService',()=>{throw new Error('Snapshots must not load GUI package manifests');});
});
afterEach(()=>{vi.doUnmock('../os/PackageManagerService');vi.unstubAllGlobals();vi.resetModules();});
describe('full snapshot preserves installed/persisted membership and registered truth',()=>{
  it('includes the whole unloaded installed record, not uninstalled storage or config fallback',async()=>{
    setPackages(['installed_cold']);const payload={value:0,unknown:{kept:true},_temp:{legacy:'unchanged'}};
    localStorage.setItem('installed_cold',JSON.stringify({state:payload,version:0}));localStorage.setItem('not_installed',JSON.stringify({secret:'omit'}));
    const {getAllStoreStates}=await import('../os/createAppStore');expect(getAllStoreStates()).toEqual({installed_cold:payload});
  });
  it('consults current membership on each call, preserving install/uninstall changes',async()=>{
    localStorage.setItem('first',JSON.stringify({value:'first'}));localStorage.setItem('second',JSON.stringify({value:'second'}));setPackages(['first']);
    const {getAllStoreStates}=await import('../os/createAppStore');expect(getAllStoreStates()).toEqual({first:{value:'first'}});
    setPackages(['second']);expect(getAllStoreStates()).toEqual({second:{value:'second'}});
    setPackages([]);expect(getAllStoreStates()).toEqual({});
  });
  it('uses the same live registry/adapters/cache and gives loaded state precedence',async()=>{
    setPackages(['loaded']);localStorage.setItem('loaded',JSON.stringify({value:999}));
    const core=await import('../os/createAppStore'),{getAllStoreStates}=await import('../os/createAppStore');
    const store=core.createVolatileAppStore('loaded',{value:3,action:()=>{}});core.registerStateAdapter('loaded',s=>({...s,derived:s.value*2}));
    const first=getAllStoreStates().loaded;expect(first).toEqual({value:3,derived:6});expect(core.getAllStoreStates().loaded).toBe(first);expect(getAllStoreStates().loaded).toBe(first);
    store.setState({value:4});const second=getAllStoreStates().loaded;expect(second).toEqual({value:4,derived:8});expect(second).not.toBe(first);
  });
  it('retains legacy raw/versioned parsing and omits malformed records without inventing defaults',async()=>{
    setPackages(['raw','wrapped','bad','array','null']);localStorage.setItem('raw',JSON.stringify({value:0}));localStorage.setItem('wrapped',JSON.stringify({state:{nested:{value:1}},version:4}));localStorage.setItem('bad','{broken');localStorage.setItem('array','[]');localStorage.setItem('null','null');
    const {getAllStoreStates}=await import('../os/createAppStore');expect(getAllStoreStates()).toEqual({raw:{value:0},wrapped:{nested:{value:1}}});
  });
  it('keeps per-app adapter failure isolated and reset operating on the same stores',async()=>{
    const core=await import('../os/createAppStore'),{getAllStoreStates}=await import('../os/createAppStore');
    const good=core.createVolatileAppStore('good',{value:7});core.createVolatileAppStore('bad',{value:9});core.registerStateAdapter('bad',()=>{throw new Error('adapter failure');});
    good.setState({value:8});expect(getAllStoreStates()).toEqual({good:{value:8},bad:{error:'Failed to get state'}});
    core.resetAllAppStores();expect(getAllStoreStates().good).toEqual({value:7});
  });
});
