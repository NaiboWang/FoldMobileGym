import React, { useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { BilibiliVideo } from '../../types';
import { useBilibiliGestures } from '../../hooks/useBilibiliGestures';
import { useCommentOwner } from '../../hooks/useCommentOwner';
import { useBilibiliStore } from '../../state';
import { COMMENT_LIMIT, commentDraftKey, commentSignature, normalizedComment, resolveComment, videoCommentSignature } from '../../utils/comments';
import { submitLocalComment } from '../../utils/commentService';
import type { CommentSourceState } from './SourceNotice';
import { fill, owned, useCommentStrings } from './shared';
export function CommentEditor({video,source,targetId,thread,blocked=false,onSaved}:{video:BilibiliVideo;source:CommentSourceState;targetId:string|null;thread:boolean;blocked?:boolean;onSaved:(id:string)=>void}){
  const s=useCommentStrings(),location=useLocation(),{bindTap}=useBilibiliGestures();
  const uid=useBilibiliStore(state=>state.user.uid??''),drafts=useBilibiliStore(state=>state.commentDrafts),ledger=useBilibiliStore(state=>state.localComments);
  const draftKey=commentDraftKey(uid,video.id,targetId),draft=drafts?.[draftKey],text=draft?.text??'';
  const target=targetId!==null?resolveComment(source.data?.[video.id],ledger?.[video.id]??[],targetId):null;
  const signature=target?commentSignature(target):null,videoSignature=videoCommentSignature(video);
  const owner=useCommentOwner(JSON.stringify([draftKey,videoSignature,signature,blocked]),draftKey),[error,setError]=useState(false),[saved,setSaved]=useState(false);
  const textarea=useRef<HTMLTextAreaElement>(null),send=useRef<HTMLButtonElement>(null),expected=useRef(draft),composing=useRef(false),focused=useRef<string|null>(null);
  expected.current=draft;
  const ready=source.ready&&!source.error&&!source.data?.[video.id]?.error&&!blocked&&(targetId===null||!!target)&&!!uid;
  const count=Array.from(text).length;
  const inputAction=thread?{id:'video.comment.thread.draft.input'}:{id:'video.comment.compose.draft.input'};
  const change=(value:string,clearing=false)=>{
    if(!owner.active()||(!ready&&!clearing))return;
    const before=expected.current;
    const ok=owner.write(()=>useBilibiliStore.getState().updateCommentDraft(draftKey,value,before));
    if(ok){expected.current=useBilibiliStore.getState().commentDrafts[draftKey];setError(false);setSaved(false);}
  };
  const submit=()=>{
    if(!ready||composing.current||!normalizedComment(text)||!draft)return;
    const claim=owner.begin();if(!claim)return;
    const result=owner.write(()=>submitLocalComment({videoId:video.id,actorId:uid,draftKey,draft,videoSignature,targetId,targetSignature:signature}));
    if(result){if(claim.active()){setSaved(true);setError(false);onSaved(result.rpid);}}
    else if(claim.active())setError(true);
    owner.revoke();
  };
  const submitProps=thread?bindTap({kind:'action',id:'video.comment.thread.submit'},{onTrigger:submit}):bindTap({kind:'action',id:'video.comment.compose.submit'},{onTrigger:submit});
  const clearProps=thread?bindTap({kind:'action',id:'video.comment.thread.clear'},{onTrigger:()=>change('',true)}):bindTap({kind:'action',id:'video.comment.compose.clear'},{onTrigger:()=>change('',true)});
  // Recipient changes keep the actual focused textarea; replacing it lets the OS
  // removal observer dismiss the newly focused keyboard during the same turn.
  useLayoutEffect(()=>{setSaved(false);setError(false);composing.current=false;},[draftKey]);
  const shouldFocus=!thread||!!new URLSearchParams(location.search).get('replyId');
  useLayoutEffect(()=>{
    if(!ready||!shouldFocus||focused.current===location.key||!owner.active())return;
    focused.current=location.key;textarea.current?.focus();
  },[ready,shouldFocus,location.key,owner]);
  return <div data-bili-comment-editor={thread?'thread':'compose'} data-bili-comment-target={targetId??''} className="border-t border-app-border bg-app-surface p-3 flex flex-col gap-2 min-h-0 overflow-y-auto" data-keep-keyboard="true">
    <p className="text-[11px] text-app-text-muted">{s.comment_local_scope}</p>
    {!uid&&<p role="alert" className="text-xs text-app-text-muted">{s.comment_identity_unavailable}</p>}
    {(blocked||(targetId!==null&&!target&&source.ready))&&<p role="alert" className="text-xs text-app-text-muted">{s.comment_target_unavailable}</p>}
    {target&&<div className="text-xs text-app-primary truncate">{fill(s.comment_reply_to,{name:target.comment.uname})}</div>}
    <textarea ref={textarea} value={text} rows={3} maxLength={COMMENT_LIMIT*2} readOnly={!ready} aria-label={thread?s.comment_reply_placeholder:s.comment_placeholder} placeholder={thread?s.comment_reply_placeholder:s.comment_placeholder}
      data-action={inputAction.id} data-action-type="input" data-action-params={JSON.stringify({value:text})}
      className="min-h-[64px] max-h-[144px] w-full resize-none rounded-xl border border-app-border p-3 text-sm bg-app-bg text-app-text outline-none"
      onChange={event=>change(event.currentTarget.value)} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;}}
      onKeyDown={event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)&&!event.nativeEvent.isComposing&&!composing.current&&event.keyCode!==229){event.preventDefault();send.current?.click();}}}/>
    <div className="flex justify-between items-center gap-2"><span className="text-[11px] text-app-text-muted">{fill(s.comment_chars,{count,limit:COMMENT_LIMIT})}</span><button type="button" onPointerDown={event=>event.preventDefault()} className="text-xs text-app-text-muted" {...owned(clearProps,owner.active)}>{s.comment_clear}</button><button ref={send} type="button" onPointerDown={event=>event.preventDefault()} disabled={!ready||!normalizedComment(text)} className="ml-auto rounded-full bg-app-primary px-4 py-2 text-white text-sm disabled:opacity-40" {...owned(submitProps,owner.active)}>{thread?s.comment_send_reply:s.comment_send}</button></div>
    {count>COMMENT_LIMIT&&<div role="alert" className="text-xs text-app-primary">{fill(s.comment_limit,{count:COMMENT_LIMIT})}</div>}
    {error&&<div role="alert" className="text-xs text-app-primary">{s.comment_send_failed}</div>}
    {saved&&<div role="status" className="text-xs text-app-primary">{thread?s.comment_saved_reply:s.comment_saved}</div>}
    <p className="text-[10px] text-app-text-muted">{s.comment_hint}</p>
  </div>;
}
