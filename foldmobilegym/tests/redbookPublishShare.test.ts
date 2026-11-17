import {describe,it,expect} from 'vitest';
import {redBookShareSeed,redBookForeignRoot,allocateRedBookNoteId} from '../apps/RedBook/utils/publishShare';
describe('RedNote isolated plain-text Activity seed',()=>{
 it('preserves raw text/Unicode and never carries caller title/media/IDs',()=>expect(redBookShareSeed({action:'ACTION_SEND',type:'text/plain',data:{text:'  原文 📝\nnext\n',title:'not a post title',stream:'/private.png',id:'private'}})).toEqual({external:true,draft:{text:'  原文 📝\nnext\n',title:'',templateId:'basic',images:[]}}));
 it('accepts MIME parameters and body alias',()=>expect(redBookShareSeed({action:'ACTION_SEND',type:' TEXT/PLAIN; charset=utf-8',data:{body:'body'}}).draft.text).toBe('body'));
 it('keeps explicit empty text over a conflicting body',()=>expect(redBookShareSeed({action:'ACTION_SEND',type:'text/plain',data:{text:'',body:'not intended'}}).draft.text).toBe(''));
 for(const type of [undefined,'image/png','application/json'])it('isolates unsupported SEND '+type,()=>expect(redBookShareSeed({action:'ACTION_SEND',type,data:{text:'must not import',stream:'/private'}})).toMatchObject({external:true,draft:{text:'',images:[]}}));
 it('rejects non-string payloads',()=>expect(redBookShareSeed({action:'ACTION_SEND',type:'text/plain',data:{text:{secret:'x'},body:123}}).draft.text).toBe(''));
 it('keeps ordinary compose external=false and returns independent mutable drafts',()=>{expect(redBookShareSeed(null).external).toBe(false);const a=redBookShareSeed(undefined),b=redBookShareSeed(undefined);a.draft.images.push('one');expect(b.draft.images).toEqual([]);});
});
describe('RedNote frozen-time publication identity',()=>{
 it('keeps the legacy first ID and valid zero epoch',()=>{expect(allocateRedBookNoteId(12,[])).toBe('note_12');expect(allocateRedBookNoteId(0,[])).toBe('note_0');});
 it('reserves all runtime/base/published namespaces without mutating pools',()=>{const a=['note_12'],b=['note_12_1'],c=['note_12_2'];expect(allocateRedBookNoteId(12,[a,b,c])).toBe('note_12_3');expect(a).toEqual(['note_12']);});
 for(const value of [NaN,Infinity,-Infinity])it('rejects nonfinite publication times '+value,()=>expect(()=>allocateRedBookNoteId(value,[])).toThrow('Invalid'));
});
describe('RedNote foreign-root only closes a real caller-owned receiver',()=>{
 const s={activeTaskId:'caller',tasks:[{taskId:'caller',rootAppId:'notes',stack:[{activityId:'notes',appId:'notes'},{activityId:'shared',appId:'redbook'}]}]};
 it('accepts its current foreground root',()=>expect(redBookForeignRoot(0,'shared',s)).toBe(true));
 for(const index of [undefined,1,-1])it('retains normal or unknown history '+index,()=>expect(redBookForeignRoot(index,'shared',s)).toBe(false));
 it('rejects another Activity, own-task, launcher, Recents and missing state',()=>{expect(redBookForeignRoot(0,'other',s)).toBe(false);expect(redBookForeignRoot(0,'shared',{...s,tasks:[{...s.tasks[0],rootAppId:'redbook'}]})).toBe(false);expect(redBookForeignRoot(0,'shared',{...s,isLauncherVisible:true})).toBe(false);expect(redBookForeignRoot(0,'shared',{...s,isRecentsVisible:true})).toBe(false);expect(redBookForeignRoot(0,'shared',undefined)).toBe(false);});
});
