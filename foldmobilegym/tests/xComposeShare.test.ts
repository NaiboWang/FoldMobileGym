import {describe,it,expect} from 'vitest';
import {xComposeShareSeed,shouldFinishXForeignRoot} from '../apps/X/utils/composeShare';
describe('X Activity-owned shared compose seed',()=>{
 it('preserves exact Unicode, leading spaces and newlines without retaining mutable intent data',()=>{const intent={action:'ACTION_SEND',type:'text/plain',data:{text:'  中文 📝\nsecond line\n'}};const seed=xComposeShareSeed(intent);intent.data.text='changed';expect(seed).toEqual({external:true,text:'  中文 📝\nsecond line\n'});});
 it('accepts normalized plain-text MIME parameters',()=>expect(xComposeShareSeed({action:'ACTION_SEND',type:' TEXT/PLAIN; charset=utf-8',data:{text:'text'}})).toEqual({external:true,text:'text'}));
 it('accepts the existing SMS-compatible body alias only if text is not a string',()=>expect(xComposeShareSeed({action:'ACTION_SEND',type:'text/plain',data:{body:'body'}}).text).toBe('body'));
 it('does not replace an explicitly empty text with a conflicting body',()=>expect(xComposeShareSeed({action:'ACTION_SEND',type:'text/plain',data:{text:'',body:'must not leak'}}).text).toBe(''));
 for(const type of ['image/png','application/json',undefined])it('isolates unsupported SEND from warm quote state '+type,()=>expect(xComposeShareSeed({action:'ACTION_SEND',type,data:{text:'not plain text',stream:'/private/path'}})).toEqual({external:true,text:''}));
 it('rejects non-string data without coercing objects',()=>expect(xComposeShareSeed({action:'ACTION_SEND',type:'text/plain',data:{text:{secret:'hidden'},body:123}})).toEqual({external:true,text:''}));
 for(const intent of [undefined,null,{action:'ACTION_VIEW',type:'text/plain',data:{text:'not a share'}}])it('preserves ordinary composer initialization '+String(intent),()=>expect(xComposeShareSeed(intent)).toEqual({external:false,text:''}));
});

describe('X foreign-root completion is not a fabricated router Back',()=>{
 const state={activeTaskId:'notes-task',isLauncherVisible:false,isRecentsVisible:false,tasks:[{taskId:'notes-task',rootAppId:'notes',stack:[{activityId:'notes-root',appId:'notes'},{activityId:'x-share',appId:'x'}]}]};
 it('returns an actual foreground borrowed root to its caller',()=>expect(shouldFinishXForeignRoot(0,'x-share',state)).toBe(true));
 for(const index of [undefined,-1,1,2])it('does not replace a real or unknown history pop '+index,()=>expect(shouldFinishXForeignRoot(index,'x-share',state)).toBe(false));
 it('does not close a different or empty Activity identity',()=>{for(const id of ['','notes-root','other'])expect(shouldFinishXForeignRoot(0,id,state)).toBe(false);});
 it('does not close a background, launcher or Recents visit',()=>{expect(shouldFinishXForeignRoot(0,'x-share',{...state,activeTaskId:'other'})).toBe(false);expect(shouldFinishXForeignRoot(0,'x-share',{...state,isLauncherVisible:true})).toBe(false);expect(shouldFinishXForeignRoot(0,'x-share',{...state,isRecentsVisible:true})).toBe(false);});
 it('preserves ordinary own-task/root behavior',()=>expect(shouldFinishXForeignRoot(0,'x-share',{...state,tasks:[{...state.tasks[0],rootAppId:'x'}]})).toBe(false));
 it('does not invent a missing caller or missing state',()=>{expect(shouldFinishXForeignRoot(0,'x-share',undefined)).toBe(false);expect(shouldFinishXForeignRoot(0,'x-share',{...state,tasks:[{...state.tasks[0],stack:[state.tasks[0].stack[1]]}]})).toBe(false);});
});
