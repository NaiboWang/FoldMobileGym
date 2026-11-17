import { useBilibiliStore } from '../state';
import { getVideosSync, getVideoCommentsSync } from '../data/loader';
import { now } from '../../../os/TimeService';
import { commentSignature, createLocalComment, resolveComment, videoCommentSignature, type CommentPlan } from './comments';
const epoch=globalThis.crypto?.randomUUID?.()??Math.random().toString(36).slice(2);
let sequence=0;
/** Synchronous local commit over the current actor, draft and actual loaded source. */
export function submitLocalComment(plan:CommentPlan) {
  const state=useBilibiliStore.getState(),video=getVideosSync()?.find(item=>item.id===plan.videoId),sources=getVideoCommentsSync();
  if(!video||!sources||sources[plan.videoId]?.error||videoCommentSignature(video)!==plan.videoSignature
    ||state.user.uid!==plan.actorId||state.commentDrafts?.[plan.draftKey]!==plan.draft)return null;
  const target=plan.targetId!==null?resolveComment(sources[plan.videoId],state.localComments?.[plan.videoId]??[],plan.targetId):null;
  if(plan.targetId!==null&&(!target||commentSignature(target)!==plan.targetSignature))return null;
  const comment=createLocalComment(`local.${epoch}.${++sequence}`,video.id,state.user,plan.draft.text,now(),target);
  return comment&&state.appendLocalComment(comment,plan.draftKey,plan.draft,plan.actorId)?comment:null;
}
