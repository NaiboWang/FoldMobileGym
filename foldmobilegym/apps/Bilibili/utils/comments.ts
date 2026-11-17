import type { BilibiliUser, BilibiliVideo, CommentReply } from '../types';
export const COMMENT_LIMIT = 1000;
export type CommentDraft = { text: string; revision: number };
export type LocalComment = CommentReply & {
  videoId: string; rootId: string | null; parentId: string | null;
  replyTo: { rpid: string; mid: string; uname: string } | null;
};
export type CommentSource = { comments: CommentReply[]; count: number; error?: string };
export type LocalCommentLease = { record: LocalComment; signature: string };
export const captureLocalComment = (record: LocalComment): LocalCommentLease => ({ record, signature: JSON.stringify(record) });
export const matchesLocalComment = (record: LocalComment, lease: LocalCommentLease | null | undefined) =>
  !!lease && record === lease.record && JSON.stringify(record) === lease.signature;
export type ResolvedComment = { comment: CommentReply; rootId: string };
export type CommentPlan = {
  videoId: string; actorId: string; draftKey: string; draft: CommentDraft;
  videoSignature: string; targetId: string | null; targetSignature: string | null;
};
export const commentDraftKey = (actor: string, video: string, target: string | null) => JSON.stringify([actor, video, target]);
export const videoCommentSignature = (video: BilibiliVideo) => JSON.stringify([video.id,video.title,video.author,video.duration,video.date]);
export const commentSignature = (target: ResolvedComment) => JSON.stringify([target.rootId,target.comment.rpid,target.comment.mid,target.comment.uname,target.comment.message,target.comment.ctime]);
export function normalizedComment(text: string) {
  const value=text.replace(/\r\n?/g,'\n').trim();
  return value && Array.from(value).length<=COMMENT_LIMIT ? value : null;
}
function sourceEntries(source?: CommentSource): ResolvedComment[] {
  const result: ResolvedComment[]=[];
  const visit=(comment:CommentReply,rootId:string,seen:Set<CommentReply>)=>{
    if(seen.has(comment))return;seen.add(comment);result.push({comment,rootId});
    for(const reply of comment.replies??[])visit(reply,rootId,seen);
  };
  for(const root of source?.comments??[])visit(root,root.rpid,new Set());
  return result;
}
export function resolveComment(source: CommentSource | undefined, local: LocalComment[], id: string): ResolvedComment | null {
  const matches=[...sourceEntries(source),...local.map(comment=>({comment,rootId:comment.rootId??comment.rpid}))].filter(item=>item.comment.rpid===id);
  if(!matches.length)return null;
  const signature=commentSignature(matches[0]);
  return matches.every(value=>commentSignature(value)===signature)?matches[0]:null;
}
export function commentRoots(source: CommentSource | undefined, local: LocalComment[]): CommentReply[] {
  return [...local.filter(comment=>comment.rootId===null),...(source?.comments??[])].map(root=>({
    ...root,rcount:Math.max(root.rcount??0,root.replies?.length??0)+local.filter(comment=>comment.rootId===root.rpid).length,
  }));
}
export function threadComments(source: CommentSource | undefined, local: LocalComment[], rootId: string): CommentReply[] {
  return [...sourceEntries(source).filter(item=>item.rootId===rootId&&item.comment.rpid!==rootId).map(item=>item.comment),
    ...local.filter(comment=>comment.rootId===rootId).slice().reverse()];
}
export function createLocalComment(id:string,videoId:string,user:BilibiliUser,message:string,time:number,target:ResolvedComment|null):LocalComment|null {
  const text=normalizedComment(message);
  if(!text||!user.uid?.trim()||!id||!Number.isFinite(time))return null;
  return {rpid:id,videoId,rootId:target?.rootId??null,parentId:target?.comment.rpid??null,
    replyTo:target?{rpid:target.comment.rpid,mid:target.comment.mid,uname:target.comment.uname}:null,
    mid:user.uid,uname:user.name,avatar:user.avatar,level:user.level,vip:user.isVip,
    message:text,like:0,ctime:Math.floor(time/1000),location:'',replies:null,rcount:0};
}
