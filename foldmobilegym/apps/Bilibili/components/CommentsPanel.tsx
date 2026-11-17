import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IcClose, IcAlignLeft } from '../res/icons';
import { useBilibiliGestures } from '../hooks/useBilibiliGestures';
import { useCommentOwner } from '../hooks/useCommentOwner';
import { useBilibiliStore } from '../state';
import type { BilibiliVideo } from '../types';
import { commentRoots, resolveComment, threadComments, videoCommentSignature } from '../utils/comments';
import { KeyboardService } from '../../../os/keyboard';
import { CommentCard } from './comments/CommentCard';
import { CommentEditor } from './comments/CommentEditor';
import { SourceNotice, type CommentSourceState } from './comments/SourceNotice';
import { fill, owned, useCommentStrings } from './comments/shared';
type Props={video:BilibiliVideo;source:CommentSourceState};
export function BilibiliCommentList({video,source,revealId,blocked}:Props&{revealId:string|null;blocked:boolean}){
  const s=useCommentStrings(),owner=useCommentOwner(videoCommentSignature(video)),{bindTap}=useBilibiliGestures();
  const local=useBilibiliStore(state=>state.localComments?.[video.id]),[order,setOrder]=useState<'hot'|'time'>('hot');
  const rows=commentRoots(source.data?.[video.id],local??[]).sort((a,b)=>order==='hot'?(b.like||0)-(a.like||0):(b.ctime||0)-(a.ctime||0));
  const ref=useRef<HTMLDivElement>(null),revealed=useRef<string|null>(null);
  useEffect(()=>{
    if(!revealId||blocked||revealed.current===revealId)return;
    const frame=requestAnimationFrame(()=>{if(!owner.active())return;const node=ref.current?.querySelector(`[data-bili-comment-id="${CSS.escape(revealId)}"]`);if(node){revealed.current=revealId;node.scrollIntoView({block:'nearest'});}});
    return()=>cancelAnimationFrame(frame);
  },[revealId,blocked,owner]);
  if(!source.ready||source.error||source.data?.[video.id]?.error)return <SourceNotice source={source} unavailable={!!source.data?.[video.id]?.error} mode="base" active={owner.active}/>;
  return <div ref={ref} className="bg-app-surface min-h-full">
    <div className="flex items-center justify-between px-4 py-3"><span className="text-sm text-app-text-muted">{order==='hot'?s.comment_hot:s.comment_recent}</span><button type="button" className="flex items-center gap-1 text-xs text-app-text-muted" {...owned(bindTap({kind:'action',id:'video.comment.sort.toggle'},{onTrigger:()=>setOrder(value=>value==='hot'?'time':'hot')}),owner.active)}><IcAlignLeft size={14}/>{order==='hot'?s.comment_by_hot:s.comment_by_time}</button></div>
    <div className="px-4 pb-24">{rows.length?rows.map(comment=><CommentCard key={comment.rpid} videoId={video.id} comment={comment} rootId={comment.rpid} active={owner.active}/>):<div className="text-center text-app-text-muted py-10">{s.comment_empty}</div>}</div>
  </div>;
}
export function BilibiliCommentEntry({video,source}:Props){
  const s=useCommentStrings(),{bindTap}=useBilibiliGestures(),owner=useCommentOwner(videoCommentSignature(video));
  return <div className="shrink-0 border-t border-app-border bg-app-surface px-4 py-2 pb-safe"><button type="button" disabled={!source.ready||source.error||!!source.data?.[video.id]?.error||!owner.actor} className="w-full bg-app-bg rounded-full text-left px-4 py-2 text-sm text-app-text-muted disabled:opacity-50" {...owned(bindTap('video.comment.compose.open'),owner.active)}>{s.comment_placeholder}</button></div>;
}
export function BilibiliCommentOverlay({video,source,onSaved,headerHeight}:Props&{onSaved:(id:string)=>void;headerHeight:string}){
  const [params]=useSearchParams(),mode=params.get('commentPanel'),thread=mode==='thread',rootId=params.get('rootId')??'',targetId=thread?(params.get('replyId')||rootId):null;
  const local=useBilibiliStore(state=>state.localComments?.[video.id])??[],s=useCommentStrings(),{bindBack,back}=useBilibiliGestures();
  const root=thread?resolveComment(source.data?.[video.id],local,rootId):null,validRoot=root?.rootId===rootId&&root.comment.rpid===rootId;
  const owner=useCommentOwner(JSON.stringify([videoCommentSignature(video),mode,rootId,targetId]));
  const rows=validRoot?threadComments(source.data?.[video.id],local,rootId):[];
  const replyCount=Math.max(root?.comment.rcount??0,root?.comment.replies?.length??0)+local.filter(comment=>comment.rootId===rootId).length;
  const [reveal,setReveal]=useState<string|null>(null),container=useRef<HTMLDivElement>(null),revealed=useRef<string|null>(null);
  useEffect(()=>{
    if(!reveal||revealed.current===reveal)return;
    const frame=requestAnimationFrame(()=>{
      if(!owner.active())return;
      const node=container.current?.querySelector(`[data-bili-comment-id="${CSS.escape(reveal)}"]`);
      if(node){revealed.current=reveal;node.scrollIntoView({block:'nearest'});}
    });
    return()=>cancelAnimationFrame(frame);
  },[reveal,owner]);
  const save=(id:string)=>{if(!owner.active())return;onSaved(id);if(thread)setReveal(id);else{document.activeElement instanceof HTMLElement&&document.activeElement.blur();KeyboardService.hide();back();}};
  if(mode!=='compose'&&mode!=='thread')return null;
  return <div className="absolute inset-0 z-[150]" data-bili-comment-overlay={mode}>
    <button type="button" tabIndex={-1} className="absolute inset-0 bg-black/30" aria-label={s.comment_close} {...owned(bindBack(),owner.active)}/>
    <section role="dialog" aria-modal="true" aria-label={thread?s.comment_thread:s.comment_compose} className={`absolute bg-app-surface text-app-text shadow-xl flex flex-col min-h-0 overflow-hidden ${thread?'inset-x-0 bottom-4 rounded-t-2xl':'bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-24px)] max-w-[560px] rounded-2xl max-h-[calc(100%-48px)]'}`}
      style={thread?{top:`max(40px, min(${headerHeight}, calc(100% - 360px)))`}:undefined}>
      <header className="shrink-0 flex justify-between items-center px-4 py-3 border-b border-app-border"><h2 className="text-base font-medium">{thread?s.comment_thread:s.comment_compose}</h2><button type="button" className="w-8 h-8 flex items-center justify-center" aria-label={s.comment_close} {...owned(bindBack(),owner.active)}><IcClose size={20}/></button></header>
      <SourceNotice source={source} unavailable={!!source.data?.[video.id]?.error} mode={thread?'thread':'compose'} active={owner.active}/>
      {thread&&<div ref={container} className="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-20" data-scroll-container="thread" data-scroll-direction="vertical">
        {source.ready&&!validRoot?<div role="alert" className="text-sm text-app-text-muted py-4">{s.comment_target_unavailable}</div>:root&&<><CommentCard videoId={video.id} comment={root.comment} rootId={rootId} thread active={owner.active}/><p className="text-xs text-app-text-muted py-3 border-t border-app-border">{fill(s.comment_loaded_replies,{loaded:rows.length,total:replyCount})}</p>{rows.length?rows.map(comment=><CommentCard key={comment.rpid} videoId={video.id} comment={comment} rootId={rootId} thread active={owner.active}/>):<div className="text-sm text-app-text-muted py-4">{s.comment_no_replies}</div>}</>}
      </div>}
      <CommentEditor video={video} source={source} targetId={targetId} blocked={thread&&!validRoot} thread={thread} onSaved={save}/>
    </section>
  </div>;
}
