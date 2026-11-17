import type {IntentPayload} from '../../../os/types/manifest';
/** An incoming SEND Activity is isolated even when its MIME/data is invalid. */
export function xComposeShareSeed(intent:IntentPayload|null|undefined):{external:boolean;text:string}{
  if(intent?.action!=='ACTION_SEND')return {external:false,text:''};
  const mime=typeof intent.type==='string'?intent.type.split(';')[0].trim().toLowerCase():'';
  if(mime!=='text/plain')return {external:true,text:''};
  const data=intent.data;
  return {external:true,text:typeof data?.text==='string'?data.text:typeof data?.body==='string'?data.body:''};
}

type ForeignActivityState = {
  activeTaskId: string | null;
  isLauncherVisible?: boolean;
  isRecentsVisible?: boolean;
  tasks: readonly {taskId:string;rootAppId:string;stack:readonly {activityId:string;appId:string}[]}[];
};
/** A root route has no React history to pop, but a borrowed Activity has a real caller. */
export function shouldFinishXForeignRoot(index:number|undefined,activityId:string,state:ForeignActivityState|undefined):boolean {
  if(index!==0||!activityId||!state||state.isLauncherVisible||state.isRecentsVisible)return false;
  const task=state.tasks.find(task=>task.taskId===state.activeTaskId);
  const top=task?.stack.at(-1);
  return !!task&&task.rootAppId!=='x'&&task.stack.length>1&&top?.appId==='x'&&top.activityId===activityId;
}
