import {useCallback,useSyncExternalStore} from 'react';
import {useActivityId} from '../../../os/ActivityContext';
import TaskManager from '../../../os/TaskManager';
type FocusState=Pick<ReturnType<typeof TaskManager.getState>,'isLauncherVisible'|'isRecentsVisible'|'activeTaskId'|'tasks'>;
/** Small control glyphs are foreground UI, not background feed media. */
export function settingsGlyphPriority(activityId:string,state:FocusState):'high'|'auto' {
 const top=state.tasks.find(task=>task.taskId===state.activeTaskId)?.stack.at(-1);
 return activityId&&!state.isLauncherVisible&&!state.isRecentsVisible&&top?.activityId===activityId?'high':'auto';
}
const subscribe=(notify:()=>void)=>TaskManager.subscribe(()=>notify());
const automatic=()=>'auto' as const;
/** React supplies the native hint before src starts loading, and releases it on background. */
export function useSettingsGlyphPriority(){
 const activityId=useActivityId();
 const snapshot=useCallback(()=>settingsGlyphPriority(activityId,TaskManager.getState()),[activityId]);
 return useSyncExternalStore(subscribe,snapshot,automatic);
}
