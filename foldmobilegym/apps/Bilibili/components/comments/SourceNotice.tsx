import React from 'react';
import { useBilibiliGestures } from '../../hooks/useBilibiliGestures';
import { useCommentSource } from '../../hooks/useCommentSource';
import { owned, useCommentStrings } from './shared';
export type CommentSourceState=ReturnType<typeof useCommentSource>;
export function SourceNotice({source,unavailable=false,mode='compose',active}:{source:CommentSourceState;unavailable?:boolean;mode?:'base'|'compose'|'thread';active:()=>boolean}){
  const s=useCommentStrings(),{bindTap}=useBilibiliGestures();
  const retry=mode==='base'?bindTap({kind:'action',id:'video.comment.source.retry'},{onTrigger:source.retry}):mode==='thread'?bindTap({kind:'action',id:'video.comment.thread.retry'},{onTrigger:source.retry}):bindTap({kind:'action',id:'video.comment.compose.retry'},{onTrigger:source.retry});
  if(!source.ready&&!source.error)return <div role="status" className="px-4 py-6 text-sm text-app-text-muted">{s.comment_loading}</div>;
  if(source.error||unavailable)return <div role="alert" className="px-4 py-3 text-sm text-app-text-muted">{s.comment_load_error}<button type="button" className="ml-3 text-app-primary" {...owned(retry,active)}>{s.comment_retry}</button></div>;
  return null;
}
