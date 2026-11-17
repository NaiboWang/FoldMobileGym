import { beforeEach, describe, expect, it, vi } from 'vitest';
const fixture=vi.hoisted(()=>({now:0,videos:[{id:'unit-video',title:'Original video'}],source:{} as Record<string,any>|null}));
vi.mock('../os/TimeService',()=>({now:()=>fixture.now}));
vi.mock('../apps/Bilibili/data/loader',()=>({getVideosSync:()=>fixture.videos,getVideoCommentsSync:()=>fixture.source}));
// Exercise the actual app actions on real Zustand; browser tests cover original persistence middleware.
vi.mock('../os/createAppStore',async()=>{
 const {create}=await import('zustand');
 return {createAppStoreWithActions:(_id:string,initial:object,creator:any)=>create((set,get)=>({...initial,...creator(set,get)})),memoSelector:(input:any,compute:any)=>(state:any)=>compute(input(state))};
});
import { useBilibiliStore } from '../apps/Bilibili/state';
import { submitLocalComment } from '../apps/Bilibili/utils/commentService';
import { commentDraftKey, commentSignature, resolveComment, videoCommentSignature, type CommentPlan } from '../apps/Bilibili/utils/comments';
const initial=useBilibiliStore.getInitialState();
const state=()=>useBilibiliStore.getState();
function plan(text='A local comment',targetId:string|null=null):CommentPlan {
 const uid=state().user.uid!,key=commentDraftKey(uid,'unit-video',targetId),old=state().commentDrafts[key];
 expect(state().updateCommentDraft(key,text,old)).toBe(true);
 const target=targetId?resolveComment(fixture.source?.['unit-video'],state().localComments['unit-video']??[],targetId):null;
 return {videoId:'unit-video',actorId:uid,draftKey:key,draft:state().commentDrafts[key],videoSignature:videoCommentSignature(fixture.videos[0]),targetId,targetSignature:target?commentSignature(target):null};
}
beforeEach(()=>{useBilibiliStore.setState(initial,true);fixture.now=0;fixture.videos=[{id:'unit-video',title:'Original video'}];fixture.source={'unit-video':{comments:[{rpid:'root',mid:'root-user',uname:'Root user',avatar:'',message:'Real original root',ctime:1,like:3,location:'',rcount:1,replies:[{rpid:'child',mid:'child-user',uname:'Child user',avatar:'',message:'Original child',ctime:2,like:0,location:'',replies:null}]}],count:8}};});
describe('source-owned local Bilibili comment commit',()=>{
 it('writes one real record, consumes only its draft and preserves original user/settings',()=>{const user=state().user,settings=state().settings,p=plan();const result=submitLocalComment(p)!;expect(result.message).toBe('A local comment');expect(state().localComments['unit-video']).toEqual([result]);expect(state().commentDrafts[p.draftKey]).toBeUndefined();expect(state().user).toBe(user);expect(state().settings).toBe(settings);expect(fixture.source!['unit-video'].count).toBe(8);});
 it('rejects the same captured draft a second time',()=>{const p=plan();expect(submitLocalComment(p)).not.toBeNull();expect(submitLocalComment(p)).toBeNull();expect(state().localComments['unit-video']).toHaveLength(1);});
 it('assigns distinct real entity IDs even when simulated timestamps repeat',()=>{const first=submitLocalComment(plan())!,second=submitLocalComment(plan('Second'))!;expect(first.rpid).not.toBe(second.rpid);expect(first.ctime).toBe(0);expect(second.ctime).toBe(0);});
 it('does not publish whitespace or lose the rejected draft',()=>{const p=plan('  \n ');expect(submitLocalComment(p)).toBeNull();expect(state().commentDrafts[p.draftKey]).toBe(p.draft);expect(state().localComments['unit-video']).toBeUndefined();});
 it('cannot post before the actual source has loaded',()=>{const p=plan();fixture.source=null;expect(submitLocalComment(p)).toBeNull();expect(state().commentDrafts[p.draftKey]).toBe(p.draft);});
 it('rejects missing/replaced video data without publishing into another video',()=>{const p=plan();fixture.videos=[{id:'unit-video',title:'Replacement'}];expect(submitLocalComment(p)).toBeNull();fixture.videos=[];expect(submitLocalComment(p)).toBeNull();});
 it('binds an actual child reply to canonical root and exact recipient',()=>{const result=submitLocalComment(plan('Reply','child'))!;expect(result).toMatchObject({rootId:'root',parentId:'child',replyTo:{rpid:'child',mid:'child-user',uname:'Child user'}});});
 it('refuses missing/replaced target identity or content',()=>{const p=plan('Reply','child');fixture.source!['unit-video'].comments[0].replies[0].message='Replaced';expect(submitLocalComment(p)).toBeNull();fixture.source!['unit-video'].comments=[];expect(submitLocalComment(p)).toBeNull();expect(state().commentDrafts[p.draftKey]).toBe(p.draft);});
 it('empty or unknown reply ID never silently becomes a new root post',()=>{expect(submitLocalComment(plan('Reply',''))).toBeNull();expect(submitLocalComment(plan('Reply','missing'))).toBeNull();expect(state().localComments['unit-video']).toBeUndefined();});
 it('a replaced draft with identical text revokes an older submission',()=>{const p=plan();state().updateCommentDraft(p.draftKey,p.draft.text,p.draft);expect(submitLocalComment(p)).toBeNull();expect(state().commentDrafts[p.draftKey]).not.toBe(p.draft);});
 it('a changed actor cannot publish the old actor draft',()=>{const p=plan();state().updateUser({uid:'different-user'});expect(submitLocalComment(p)).toBeNull();expect(state().commentDrafts[p.draftKey]).toBe(p.draft);});
 it('new local root replies use actual records and fail if that root disappears',()=>{const post=submitLocalComment(plan())!,p=plan('Reply to own root',post.rpid);useBilibiliStore.setState({localComments:{'unit-video':[]}});expect(submitLocalComment(p)).toBeNull();expect(state().commentDrafts[p.draftKey]).toBe(p.draft);});
 it('atomic store duplicate rejection does not consume a newer draft',()=>{const first=submitLocalComment(plan())!,p=plan('Keep this draft');expect(state().appendLocalComment(first,p.draftKey,p.draft,p.actorId)).toBe(false);expect(state().commentDrafts[p.draftKey]).toBe(p.draft);expect(state().localComments['unit-video']).toHaveLength(1);});
});

describe('local comment reactions',()=>{
 it('scopes like/dislike to video and comment identity and toggles the same reaction off',()=>{
  state().toggleCommentReaction('unit-video','root','like');
  expect(state().commentReactions).toEqual({'unit-video:root':'like'});
  state().toggleCommentReaction('unit-video','root','dislike');
  expect(state().commentReactions).toEqual({'unit-video:root':'dislike'});
  state().toggleCommentReaction('unit-video','root','dislike');
  expect(state().commentReactions).toEqual({});
  state().toggleCommentReaction('other-video','root','like');
  expect(state().commentReactions).toEqual({'other-video:root':'like'});
 });
});

describe('local comment edit and delete ownership',()=>{
 it('rejects a stale edit and deletion after same-ID replacement',()=>{
  const original=submitLocalComment(plan())!;
  const expected={record:original,signature:JSON.stringify(original)};
  const replacement={...original,message:'Newer local content'};
  useBilibiliStore.setState({localComments:{'unit-video':[replacement]}});
  expect(state().updateLocalComment('unit-video',original.rpid,state().user.uid!,'Old draft',expected)).toBe(false);
  expect(state().deleteLocalComment('unit-video',original.rpid,state().user.uid!,expected)).toBe(false);
  expect(state().localComments['unit-video']).toEqual([replacement]);
 });
 it('edits and deletes only the current actor local record',()=>{
  const post=submitLocalComment(plan())!;
  const lease=()=>{const record=state().localComments['unit-video'][0];return {record,signature:JSON.stringify(record)};};
  expect(state().updateLocalComment('unit-video',post.rpid,state().user.uid!,'Edited local comment',lease())).toBe(true);
  expect(state().localComments['unit-video']?.[0].message).toBe('Edited local comment');
  expect(state().updateLocalComment('unit-video',post.rpid,'other-user','Wrong actor',lease())).toBe(false);
  expect(state().updateLocalComment('unit-video',post.rpid,state().user.uid!,'x'.repeat(1001),lease())).toBe(false);
  expect(state().localComments['unit-video']?.[0].message).toBe('Edited local comment');
  expect(state().deleteLocalComment('unit-video',post.rpid,'other-user',lease())).toBe(false);
  expect(state().updateLocalComment('unit-video',post.rpid,state().user.uid!,'   ',lease())).toBe(false);
  expect(state().localComments['unit-video']).toHaveLength(1);
  expect(state().deleteLocalComment('unit-video',post.rpid,state().user.uid!,lease())).toBe(true);
  expect(state().localComments['unit-video']).toEqual([]);
 });
 it('rejects in-place edits, identical replacements and duplicate IDs without writing',()=>{
  const original=submitLocalComment(plan())!;
  const expected={record:original,signature:JSON.stringify(original)};
  original.message='Mutated in place';
  expect(state().updateLocalComment('unit-video',original.rpid,state().user.uid!,'Old draft',expected)).toBe(false);
  expect(state().deleteLocalComment('unit-video',original.rpid,state().user.uid!,expected)).toBe(false);
  const identical={...original};
  const current={record:original,signature:JSON.stringify(original)};
  useBilibiliStore.setState({localComments:{'unit-video':[identical]}});
  expect(state().deleteLocalComment('unit-video',original.rpid,state().user.uid!,current)).toBe(false);
  useBilibiliStore.setState({localComments:{'unit-video':[original,identical]}});
  expect(state().updateLocalComment('unit-video',original.rpid,state().user.uid!,'Ambiguous',current)).toBe(false);
  expect(state().localComments['unit-video']).toEqual([original,identical]);
 });
});
