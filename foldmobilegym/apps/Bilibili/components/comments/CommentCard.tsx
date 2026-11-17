import React, { useRef, useState } from 'react';
import { IcLike, IcDislike } from '../../res/icons';
import { useBilibiliGestures } from '../../hooks/useBilibiliGestures';
import { useBilibiliStore } from '../../state';
import type { CommentReply } from '../../types';
import { captureLocalComment, type LocalComment, type LocalCommentLease } from '../../utils/comments';
import { useSystemTime } from '../../../../os/useSystemTime';
import * as TimeService from '../../../../os/TimeService';
import { fill, owned, useCommentStrings } from './shared';
export function CommentCard({videoId,comment,rootId,thread,active}:{videoId:string;comment:CommentReply;rootId:string;thread?:boolean;active:()=>boolean}){
  const s=useCommentStrings(),{bindTap}=useBilibiliGestures(),{now}=useSystemTime();
  const uid=useBilibiliStore(state=>state.user.uid),[expanded,setExpanded]=useState(false),[editing,setEditing]=useState(false),[confirmDelete,setConfirmDelete]=useState(false),[editText,setEditText]=useState(comment.message);
  const local=comment.rpid.startsWith('local.'),canLink=!!comment.mid&&(!local||comment.mid===uid),reaction=useBilibiliStore(state=>state.commentReactions?.[`${videoId}:${comment.rpid}`]);
  const toggleReaction=useBilibiliStore(state=>state.toggleCommentReaction),updateLocalComment=useBilibiliStore(state=>state.updateLocalComment),deleteLocalComment=useBilibiliStore(state=>state.deleteLocalComment);
  const canEdit=local&&comment.mid===uid;
  const editLease=useRef<LocalCommentLease|null>(null),deleteLease=useRef<LocalCommentLease|null>(null);
  const [conflict,setConflict]=useState(false);
  const capture=()=>{const rows=useBilibiliStore.getState().localComments?.[videoId]?.filter(entry=>entry.rpid===comment.rpid)??[];return rows.length===1?captureLocalComment(rows[0]):null;};
  const saveEdit=()=>{if(updateLocalComment(videoId,comment.rpid,uid??'',editText,editLease.current)){setEditing(false);setConflict(false);}else setConflict(true);};
  const editProps=owned(bindTap({kind:'action',id:'video.comment.item.edit.open'},{params:{videoId,commentId:comment.rpid},onTrigger:()=>{editLease.current=capture();setConflict(false);setEditText(comment.message);setEditing(true);}}),active);
  const saveEditProps=owned(bindTap({kind:'action',id:'video.comment.item.edit.submit'},{params:{videoId,commentId:comment.rpid},onTrigger:saveEdit}),active);
  const cancelEditProps=owned(bindTap({kind:'action',id:'video.comment.item.edit.cancel'},{params:{videoId,commentId:comment.rpid},onTrigger:()=>{setEditText(comment.message);setEditing(false);}}),active);
  const deleteProps=owned(bindTap({kind:'action',id:'video.comment.item.delete.submit'},{params:{videoId,commentId:comment.rpid},onTrigger:()=>{if(!deleteLocalComment(videoId,comment.rpid,uid??'',deleteLease.current))setConflict(true);}}),active);
  const authorProps=comment.mid===uid?bindTap('space.open'):bindTap('user.open',{params:{mid:comment.mid}});
  const replyProps=thread?bindTap('video.comment.reply.select',{params:{rootId,replyId:comment.rpid}}):bindTap('video.comment.reply.open',{params:{rootId,replyId:comment.rpid}});
  const expandProps=thread?bindTap({kind:'action',id:'video.thread.item.expand.toggle'},{params:{commentId:comment.rpid},onTrigger:()=>setExpanded(value=>!value)}):bindTap({kind:'action',id:'video.comment.item.expand.toggle'},{params:{commentId:comment.rpid},onTrigger:()=>setExpanded(value=>!value)});
  const likeProps=owned(bindTap({kind:'action',id:'video.comment.item.like.toggle'},{params:{videoId,commentId:comment.rpid},onTrigger:()=>toggleReaction(videoId,comment.rpid,'like')}),active);
  const dislikeProps=owned(bindTap({kind:'action',id:'video.comment.item.dislike.toggle'},{params:{videoId,commentId:comment.rpid},onTrigger:()=>toggleReaction(videoId,comment.rpid,'dislike')}),active);
  const replyTo=(comment as Partial<LocalComment>).replyTo;
  const replyCount=Math.max(comment.rcount??0,comment.replies?.length??0);
  const chars=Array.from(comment.message),display=expanded?comment.message:chars.slice(0,100).join('');
  const current=now()/1000,diff=current-comment.ctime;
  const stamp=!Number.isFinite(comment.ctime)?'':diff>=0&&diff<60?s.comment_just_now:diff>=60&&diff<3600?fill(s.comment_minutes_ago,{count:Math.floor(diff/60)}):diff>=3600&&diff<86400?fill(s.comment_hours_ago,{count:Math.floor(diff/3600)}):diff>=86400&&diff<86400*30?fill(s.comment_days_ago,{count:Math.floor(diff/86400)}):TimeService.fromTimestamp(comment.ctime*1000).toLocaleDateString();
  return <article data-bili-comment-id={comment.rpid} className="flex gap-3 mb-5 min-w-0">
    <button type="button" disabled={!canLink} className="w-9 h-9 shrink-0 rounded-full overflow-hidden bg-app-bg" {...owned(authorProps,active)} aria-label={comment.uname||s.comment_me}>
      {comment.avatar?<img src={comment.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy"/>:<span>{(comment.uname||s.comment_me).slice(0,1)}</span>}
    </button>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 text-xs"><button type="button" disabled={!canLink} className="text-app-text-muted truncate" {...owned(authorProps,active)}>{comment.uname||s.comment_me}</button><span className="bg-app-primary text-white rounded px-1">LV{comment.level??0}</span>{local&&<span className="text-app-primary">{s.comment_local_label}</span>}</div>
      {replyTo&&<p className="mt-2 text-xs text-app-primary">{fill(s.comment_reply_to,{name:replyTo.uname})}</p>}
      <div data-bili-comment-text className="text-[15px] text-app-text whitespace-pre-wrap break-words leading-normal mt-2">{display}{chars.length>100&&<button type="button" className="ml-1 text-app-primary text-sm" {...owned(expandProps,active)}>{expanded?s.comment_collapse:s.comment_expand}</button>}</div>
      {editing&&canEdit&&<div className="mt-2 flex gap-2 items-end" data-keep-keyboard="true"><textarea value={editText} onChange={event=>setEditText(event.currentTarget.value)} maxLength={2000} className="min-h-[56px] flex-1 rounded-lg border border-app-border bg-app-bg p-2 text-sm" aria-label={s.comment_edit_placeholder}/><div className="flex flex-col gap-1"><button type="button" onPointerDown={event=>event.preventDefault()} className="text-xs text-app-primary" {...saveEditProps}>{s.comment_edit_save}</button><button type="button" onPointerDown={event=>event.preventDefault()} className="text-xs text-app-text-muted" {...cancelEditProps}>{s.comment_edit_cancel}</button></div></div>}
      {conflict&&<p role="alert" className="mt-2 text-xs text-app-primary">{s.comment_edit_conflict}</p>}
      {confirmDelete&&canEdit&&<div role="group" aria-label={s.comment_delete_confirm} className="mt-2 flex flex-wrap items-center gap-3 text-xs"><span>{s.comment_delete_confirm}</span><button type="button" {...deleteProps}>{s.comment_delete}</button><button type="button" onClick={()=>{setConfirmDelete(false);setConflict(false);}}>{s.comment_edit_cancel}</button></div>}
      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-app-text-muted">
        <span>{stamp} {comment.location?.replace('IP属地：','')}</span>
        {canEdit&&!editing&&!confirmDelete&&<>
          <button type="button" className="text-app-text-muted" {...editProps}>{s.comment_edit}</button>
          <button type="button" className="text-app-text-muted" onClick={()=>{if(active()){deleteLease.current=capture();setConflict(false);setConfirmDelete(true);}}}>{s.comment_delete}</button>
        </>}
        <button type="button" data-keep-keyboard="true" onPointerDown={event=>event.preventDefault()} className="text-app-text-muted" {...owned(replyProps,active)}>{s.comment_reply}</button>
        <button type="button" aria-label={reaction==='like'?s.comment_unlike:s.comment_like} className={`inline-flex gap-1 items-center ${reaction==='like'?'text-app-primary':''}`} {...likeProps}><IcLike size={14}/>{(comment.like||0)+(reaction==='like'?1:0)}</button>
        <button type="button" aria-label={reaction==='dislike'?s.comment_undislike:s.comment_dislike} className={`inline-flex gap-1 items-center ${reaction==='dislike'?'text-app-primary':''}`} {...dislikeProps}><IcDislike size={14}/></button>
      </div>
      {!thread&&!!comment.replies?.length&&<div className="mt-3 rounded-lg px-3 py-2 bg-app-bg text-[13px] text-app-text"><span className="text-app-primary mr-1">{comment.replies[0].uname}</span>{Array.from(comment.replies[0].message).slice(0,50).join('')}</div>}
      {!thread&&replyCount>0&&<button type="button" className="mt-3 bg-app-bg text-app-primary text-xs rounded-lg px-3 py-2" {...owned(bindTap('video.comment.thread.open',{params:{rootId}}),active)}>{fill(s.comment_view_replies,{count:replyCount})}</button>}
    </div>
  </article>;
}
