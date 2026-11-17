import { describe, expect, it } from 'vitest';
import { canAdvanceVisiblePreview } from '../apps/Bilibili/utils/previewVisibility';
import type { OSState } from '../os/types';
const task=(taskId: string,activityId: string)=>({taskId,stack:[{activityId}]});
const base={tasks:[task('a','a-top'),task('b','b-top'),task('c','c-top')],activeTaskId:'b',isLauncherVisible:false,isRecentsVisible:false} as unknown as OSState;
const split={mode:'split',primary_task_id:'a',secondary_task_id:'b'};
describe('visible preview Activity ownership',()=>{
 it('allows either visible top pane without requiring focus',()=>{
  expect(canAdvanceVisiblePreview(base,'a-top','a',split)).toBe(true);
  expect(canAdvanceVisiblePreview(base,'b-top','b',split)).toBe(true);
 });
 it('rejects overlays, missing identities and covered or removed Activities',()=>{
  expect(canAdvanceVisiblePreview({...base,isLauncherVisible:true},'a-top','a',split)).toBe(false);
  expect(canAdvanceVisiblePreview({...base,isRecentsVisible:true},'a-top','a',split)).toBe(false);
  expect(canAdvanceVisiblePreview(base,'','a',split)).toBe(false);
  expect(canAdvanceVisiblePreview(base,'not-top','a',split)).toBe(false);
  expect(canAdvanceVisiblePreview({...base,tasks:[task('b','b-top')] as OSState['tasks']},'a-top','a',split)).toBe(false);
 });
 it('rejects stale split pairs and tasks outside the visible pair',()=>{
  expect(canAdvanceVisiblePreview({...base,activeTaskId:'c'},'a-top','a',split)).toBe(false);
  expect(canAdvanceVisiblePreview(base,'c-top','c',split)).toBe(false);
  expect(canAdvanceVisiblePreview(base,'a-top','a',{...split,mode:'fullscreen'})).toBe(false);
  expect(canAdvanceVisiblePreview({...base,tasks:[task('a','a-top')] as OSState['tasks']},'a-top','a',split)).toBe(false);
 });
});
