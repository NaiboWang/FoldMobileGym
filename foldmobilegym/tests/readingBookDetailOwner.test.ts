import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const h=vi.hoisted(()=>({location:{key:'entry'},navigator:{location:{key:'entry'}},cleanup:[] as Array<()=>void>}));
vi.mock('react',()=>({useContext:()=>({navigator:h.navigator}),useRef:(current:unknown)=>({current}),useEffect:(fn:()=>()=>void)=>{h.cleanup.push(fn());}}));
vi.mock('react-router-dom',()=>({UNSAFE_NavigationContext:{},useLocation:()=>h.location}));
vi.mock('../os/ActivityContext',()=>({useActivityId:()=> 'reading-activity'}));
import {useBookDetailInteractionOwner} from '../apps/WechatReading/hooks/useBookDetailInteractionOwner';
let os:any;
beforeEach(()=>{h.cleanup=[];h.location={key:'entry'};h.navigator={location:{key:'entry'}};os={activeTaskId:'reading-task',tasks:[{taskId:'reading-task',stack:[{activityId:'reading-activity'}]}],isLauncherVisible:false,isRecentsVisible:false};vi.stubGlobal('window',{__OS__:{getState:()=>os}});});
afterEach(()=>vi.unstubAllGlobals());
describe('BookDetail foreground route ownership',()=>{
 it('accepts its actual foreground Activity',()=>expect(useBookDetailInteractionOwner()()).toBe(true));
 it.each(['isLauncherVisible','isRecentsVisible'])('rejects %s synchronously',key=>{const owns=useBookDetailInteractionOwner();os[key]=true;expect(owns()).toBe(false);});
 it('rejects another task',()=>{const owns=useBookDetailInteractionOwner();os.activeTaskId='other';expect(owns()).toBe(false);});
 it('rejects a new top Activity in the same task',()=>{const owns=useBookDetailInteractionOwner();os.tasks[0].stack.push({activityId:'other'});expect(owns()).toBe(false);});
 it('rejects same-frame Back before React rerenders',()=>{const owns=useBookDetailInteractionOwner();h.navigator.location={key:'previous'};expect(owns()).toBe(false);});
 it('rejects a superseded rendered route',()=>{const owns=useBookDetailInteractionOwner();h.location={key:'other'};h.navigator.location=h.location;expect(owns()).toBe(false);});
 it('rejects unmounted callbacks',()=>{const owns=useBookDetailInteractionOwner();h.cleanup.forEach(fn=>fn());expect(owns()).toBe(false);});
 it('rejects a missing runtime',()=>{const owns=useBookDetailInteractionOwner();vi.stubGlobal('window',{});expect(owns()).toBe(false);});
});
