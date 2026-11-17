import type {IntentPayload} from '../../../os/types/manifest';
import type {RedBookPublishDraft} from '../types';
export function redBookShareSeed(intent:IntentPayload|null|undefined):{external:boolean;draft:RedBookPublishDraft}{
 const external=intent?.action==='ACTION_SEND';
 const mime=typeof intent?.type==='string'?intent.type.split(';')[0].trim().toLowerCase():'';
 const data=external&&mime==='text/plain'?intent?.data:undefined;
 const text=typeof data?.text==='string'?data.text:typeof data?.body==='string'?data.body:'';
 return {external,draft:{text,templateId:'basic',title:'',images:[]}};
}
export function allocateRedBookNoteId(time:number,pools:readonly Iterable<string>[]):string{
 if(!Number.isFinite(time))throw new Error('Invalid publication time');
 const occupied=new Set(pools.flatMap(pool=>[...pool]));const base=`note_${time}`;let id=base,suffix=0;
 while(occupied.has(id))id=base+'_'+(++suffix);
 return id;
}
type StackState={activeTaskId:string|null;isLauncherVisible?:boolean;isRecentsVisible?:boolean;tasks:readonly {taskId:string;rootAppId:string;stack:readonly {activityId:string;appId:string}[]}[]};
export function redBookForeignRoot(index:number|undefined,id:string,state:StackState|undefined):boolean{
 if(index!==0||!id||!state||state.isLauncherVisible||state.isRecentsVisible)return false;
 const task=state.tasks.find(t=>t.taskId===state.activeTaskId),top=task?.stack.at(-1);
 return !!task&&task.rootAppId!=='redbook'&&task.stack.length>1&&top?.appId==='redbook'&&top.activityId===id;
}
