import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
const h=vi.hoisted(()=>({refs:[] as unknown[],active:null as any,foreground:true,root:null as any,dialog:null as any,first:null as any,cancel:null as any,opener:null as any}));
vi.mock('react',()=>({useCallback:(fn:unknown)=>fn,useLayoutEffect:(fn:()=>void)=>fn(),useRef:()=>({current:h.refs.shift()}),useSyncExternalStore:(_s:unknown,get:()=>boolean)=>get()}));
vi.mock('../os/ActivityContext',()=>({useActivityId:()=> 'detail'}));
vi.mock('../os/TaskManager',()=>({default:{subscribe:()=>()=>{},getState:()=>({isLauncherVisible:false,isRecentsVisible:false,activeTaskId:'task',tasks:[{taskId:'task',stack:[{activityId:h.foreground?'detail':'clock'}]}]})}}));
import {useShelfDialogFocus} from '../apps/WechatReading/hooks/useShelfDialogFocus';
beforeEach(()=>{
 h.active=null;h.foreground=true;
 const button=()=>({isConnected:true,checkVisibility:()=>true,closest:()=>null,matches:()=>false,getBoundingClientRect:()=>({top:10,bottom:30}),focus(){h.active=this;}});
 h.first=button();h.cancel=button();h.opener=button();
 h.dialog={clientHeight:100,scrollTop:0,contains:(e:unknown)=>[h.first,h.cancel].includes(e),querySelector:()=>h.cancel,querySelectorAll:()=>[h.first,h.cancel],getBoundingClientRect:()=>({top:0,bottom:100,height:100})};
 h.root={checkVisibility:()=>true,contains:()=>true,querySelector:(s:string)=>s==='[role="dialog"]'?h.dialog:h.opener};h.refs=[h.root,h.opener,false];
 vi.stubGlobal('document',{get activeElement(){return h.active;}});
});
afterEach(()=>vi.unstubAllGlobals());
describe('Shared shelf and detail dialog focus scopes',()=>{
 it('retains the existing shelf confirmation initial Cancel focus',()=>{useShelfDialogFocus(true,'/bookshelf','entry');expect(h.active).toBe(h.cancel);});
 it('focuses the first action in a detail menu, not an offscreen Cancel',()=>{useShelfDialogFocus(true,'/book/existing','entry','bookDetail');expect(h.active).toBe(h.first);});
 it('does not let the permanently mounted shelf steal detail focus',()=>{useShelfDialogFocus(true,'/book/existing','entry');expect(h.active).toBeNull();});
 it('does not focus a detail menu on another route',()=>{useShelfDialogFocus(true,'/read/existing','entry','bookDetail');expect(h.active).toBeNull();});
 it('does not move focus from the foreground sibling Clock',()=>{h.foreground=false;useShelfDialogFocus(true,'/book/existing','entry','bookDetail');expect(h.active).toBeNull();});
 it('restores a still-mounted opener when the owning menu closes',()=>{h.refs=[h.root,h.opener,true];useShelfDialogFocus(false,'/book/existing','closed','bookDetail');expect(h.active).toBe(h.opener);});
 it('keeps keyboard Tab inside the active menu',()=>{const hook=useShelfDialogFocus(true,'/book/existing','entry','bookDetail');const preventDefault=vi.fn();hook.trapFocus({key:'Tab',currentTarget:h.dialog,preventDefault} as any);expect(h.active).toBe(h.cancel);expect(preventDefault).toHaveBeenCalledOnce();hook.trapFocus({key:'Tab',currentTarget:h.dialog,preventDefault} as any);expect(h.active).toBe(h.first);});
});
