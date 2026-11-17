import { describe, expect, it } from 'vitest';
import PackageManagerService from '../os/PackageManagerService';
import { getInstalledPackageIds } from '../os/installedPackageIds';
import { INITIAL_INSTALLED_PACKAGE_IDS } from '../os/data/installedPackageIds.generated';
import { getAllStoreStates, getAllRegisteredAppIds } from '../os/createAppStore';
describe('real PackageManager membership and public snapshot compatibility',()=>{
 it('has exactly the same initial membership/order as real eager metadata discovery',()=>{expect(getInstalledPackageIds()).toEqual(PackageManagerService.getInstalledPackages().map(m=>m.id));expect(getInstalledPackageIds()).toEqual(INITIAL_INSTALLED_PACKAGE_IDS);});
 it('keeps the actual live install/uninstall truth, including cold persisted records',()=>{
  const metadata=PackageManagerService.getInstalledPackages().find(m=>!getAllRegisteredAppIds().includes(m.id));expect(metadata).toBeDefined();
  const values=new Map<string,string>(),previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)}});
  try{
   values.set(metadata!.id,JSON.stringify({state:{actual_cold_record:{value:0}},version:0}));expect(getAllStoreStates()[metadata!.id]).toEqual({actual_cold_record:{value:0}});
   PackageManagerService.uninstall(metadata!.id);expect(getInstalledPackageIds()).toEqual(PackageManagerService.getInstalledPackages().map(m=>m.id));expect(getAllStoreStates()[metadata!.id]).toBeUndefined();
   PackageManagerService.install(metadata!);expect(getInstalledPackageIds()).toEqual(PackageManagerService.getInstalledPackages().map(m=>m.id));expect(getAllStoreStates()[metadata!.id]).toEqual({actual_cold_record:{value:0}});
  }finally{PackageManagerService.install(metadata!);if(previous)Object.defineProperty(globalThis,'localStorage',previous);else Reflect.deleteProperty(globalThis,'localStorage');}
 });
});
