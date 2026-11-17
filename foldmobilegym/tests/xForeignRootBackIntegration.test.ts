import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {createElement} from 'react';
import {renderToString} from 'react-dom/server';
import {ActivityContext} from '../os/ActivityContext';
const f=vi.hoisted(()=>({
  navigate:vi.fn(),finish:vi.fn(),navigator:{index:0 as number|undefined},
  location:{pathname:'/compose',search:'',key:'visit'},
  os:{activeTaskId:'caller',isLauncherVisible:false,isRecentsVisible:false,tasks:[{taskId:'caller',rootAppId:'notes',stack:[{activityId:'notes',appId:'notes'},{activityId:'x-receiver',appId:'x'}]}]},
}));
vi.mock('react-router-dom',async()=>{
  const {createContext}=await import('react');
  return {UNSAFE_NavigationContext:createContext({navigator:f.navigator}),useLocation:()=>f.location,useNavigate:()=>f.navigate};
});
import {useAppNavigate} from '../apps/X/navigation';
let api:ReturnType<typeof useAppNavigate>|undefined;
function Probe(){api=useAppNavigate();return null;}
function mount(activityId='x-receiver'){
  renderToString(createElement(ActivityContext.Provider,{value:{activityId,appId:'x',taskId:'caller'}},createElement(Probe)));
  expect(api).toBeDefined();
}
beforeEach(()=>{
  f.navigate.mockReset();f.finish.mockReset();f.navigator.index=0;
  f.location={pathname:'/compose',search:'',key:'visit'};
  f.os={activeTaskId:'caller',isLauncherVisible:false,isRecentsVisible:false,tasks:[{taskId:'caller',rootAppId:'notes',stack:[{activityId:'notes',appId:'notes'},{activityId:'x-receiver',appId:'x'}]}]};
  vi.stubGlobal('window',{__OS__:{getState:()=>f.os,finishActivity:f.finish}});api=undefined;
});
afterEach(()=>vi.unstubAllGlobals());
describe('actual X navigation hook foreign-root Back wiring (mocked platform, not browser acceptance)',()=>{
 it('finishes the real caller Activity rather than issuing a no-op history pop',()=>{mount();api!.back();expect(f.finish).toHaveBeenCalledTimes(1);expect(f.navigate).not.toHaveBeenCalled();});
 it('preserves a normal existing history pop',()=>{f.navigator.index=1;mount();api!.back();expect(f.finish).not.toHaveBeenCalled();expect(f.navigate).toHaveBeenCalledExactlyOnceWith(-1);});
 it('closes a cold sheet before attempting to finish its Activity',()=>{f.location={pathname:'/status/actual',search:'?sheet=retweet&sheetPostId=actual',key:'sheet'};mount();api!.back();expect(f.finish).not.toHaveBeenCalled();expect(f.navigate).toHaveBeenCalledExactlyOnceWith('/status/actual',{replace:true});});
 it('does not change own-task root behavior',()=>{f.os.tasks[0].rootAppId='x';mount();api!.back();expect(f.finish).not.toHaveBeenCalled();expect(f.navigate).toHaveBeenCalledExactlyOnceWith(-1);});
 it('does not finish another active Activity',()=>{mount('old-x');api!.back();expect(f.finish).not.toHaveBeenCalled();expect(f.navigate).toHaveBeenCalledExactlyOnceWith(-1);});
 it('does not invent an unknown history index or multi-step Activity pop',()=>{f.navigator.index=undefined;mount();api!.back();expect(f.finish).not.toHaveBeenCalled();expect(f.navigate).toHaveBeenCalledExactlyOnceWith(-1);f.navigate.mockClear();api!.back(2);expect(f.finish).not.toHaveBeenCalled();expect(f.navigate).toHaveBeenCalledExactlyOnceWith(-2);});
 it('never finishes through the OS while launcher or Recents owns the foreground',()=>{for(const flag of ['isLauncherVisible','isRecentsVisible'] as const){f.os[flag]=true;mount();api!.back();expect(f.finish).not.toHaveBeenCalled();f.os[flag]=false;}});
});
