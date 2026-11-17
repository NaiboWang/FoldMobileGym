import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
const h=vi.hoisted(()=>({state:null as any,listeners:[] as Array<()=>void>,closed:0,snapshot:null as null|(()=>string),server:null as null|(()=>string)}));
vi.mock('react',()=>({useCallback:(fn:unknown)=>fn,useSyncExternalStore:(subscribe:(notify:()=>void)=>()=>void,get:()=>string,server:()=>string)=>{h.snapshot=get;h.server=server;const off=subscribe(()=>{});h.listeners.push(off);return get();}}));
vi.mock('../os/ActivityContext',()=>({useActivityId:()=> 'settings-activity'}));
vi.mock('../os/TaskManager',()=>({default:{getState:()=>h.state,subscribe:(fn:()=>void)=>{fn();return()=>{h.closed++;};}}}));
import {settingsGlyphPriority,useSettingsGlyphPriority} from '../system/Settings/hooks/useSettingsGlyphPriority';
beforeEach(()=>{h.state={isLauncherVisible:false,isRecentsVisible:false,activeTaskId:'settings-task',tasks:[{taskId:'settings-task',stack:[{activityId:'settings-activity'}]}]};h.listeners=[];h.closed=0;h.snapshot=null;h.server=null;});
afterEach(()=>h.listeners.forEach(off=>off()));
describe('Settings native glyph priority belongs to the foreground Activity',()=>{
 it('provides high on the first foreground render, without waiting for a visibility observer',()=>expect(useSettingsGlyphPriority()).toBe('high'));
 it.each(['isLauncherVisible','isRecentsVisible'])('releases priority while %s is visible',key=>{h.state[key]=true;expect(useSettingsGlyphPriority()).toBe('auto');});
 it('does not boost a background task or a covered Activity',()=>{h.state.activeTaskId='clock';expect(settingsGlyphPriority('settings-activity',h.state)).toBe('auto');h.state.activeTaskId='settings-task';h.state.tasks[0].stack.push({activityId:'other'});expect(settingsGlyphPriority('settings-activity',h.state)).toBe('auto');});
 it('does not guess ownership for missing Activity context',()=>expect(settingsGlyphPriority('',h.state)).toBe('auto'));
 it('reads live foreground state instead of caching a launch decision',()=>{useSettingsGlyphPriority();h.state.isLauncherVisible=true;expect(h.snapshot?.()).toBe('auto');h.state.isLauncherVisible=false;expect(h.snapshot?.()).toBe('high');});
 it('keeps snapshots primitive and server rendering automatic',()=>{expect(useSettingsGlyphPriority()).toBe(useSettingsGlyphPriority());expect(h.server?.()).toBe('auto');});
 it('lets React clean up subscriptions instead of retaining an old foreground owner',()=>{useSettingsGlyphPriority();h.listeners.pop()?.();expect(h.closed).toBe(1);});
});
