import React,{createContext,useCallback,useContext,useEffect,useMemo,useRef,useState} from 'react';
import {useLocation,useNavigate,UNSAFE_NavigationContext} from 'react-router-dom';
import {memoryHistoryPopToFirstMatch} from '../../../os/utils/memoryHistoryPopTo';
import {useActivityId} from '../../../os/ActivityContext';
import {useShallow} from 'zustand/react/shallow';
import {useRedBookStore} from '../state';
import type {RedBookPublishDraft,Note} from '../types';
import {redBookShareSeed} from '../utils/publishShare';
import {copyPublishDraft,ownedSavedDraft,matchingSavedDraft,type SavedDraftRef} from '../utils/savedPublishDrafts';
import {useRedBookStrings} from '../hooks/useRedBookStrings';
import {useRedBookGestures} from '../hooks/useRedBookGestures';
type Session={external:boolean;isolated:boolean;resumed:boolean;publishDraft:RedBookPublishDraft;updatePublishDraft:(patch:Partial<RedBookPublishDraft>)=>void;save:(patch:Partial<RedBookPublishDraft>)=>boolean;publish:(data:Pick<Note,'title'|'content'|'images'>)=>boolean;finish:()=>void};
const Context=createContext<Session|null>(null);
function Unavailable(){const s=useRedBookStrings(),{bindBack}=useRedBookGestures();return <div className="h-full bg-app-surface p-6 pt-12"><button {...bindBack()} className="p-3 text-app-primary">{s.cancel}</button><p role="alert" className="p-3">{s.saved_draft_unavailable}</p></div>;}
function Scope({children,external,resumeId}:{children:React.ReactNode;external:boolean;resumeId:string|null}){
 const id=useActivityId(),userId=useRedBookStore(s=>s.user.id),table=useRedBookStore(s=>s.savedPublishDrafts),owner=useRef(userId);
 const location=useLocation(),navigate=useNavigate(),{navigator}=useContext(UNSAFE_NavigationContext);
 const initial=useRef(resumeId!==null?ownedSavedDraft(table,resumeId,userId):undefined),isolated=external||resumeId!==null;
 const seed=useMemo(()=>redBookShareSeed(id?window.__OS__?.getIntentPayload(id):null),[id]);
 const [draft,setDraft]=useState(()=>initial.current?copyPublishDraft(initial.current):seed.draft);
 const [reference,setReference]=useState<SavedDraftRef|null>(()=>initial.current?{id:initial.current.id,revision:initial.current.revision}:null);
 const current=useRef(reference),completed=useRef(false);current.current=reference;
 useEffect(()=>{if(!isolated&&!location.pathname.startsWith('/publish/text')){current.current=null;setReference(null);completed.current=false;}},[isolated,location.pathname]);
 const global=useRedBookStore(useShallow(s=>({publishDraft:s.publishDraft,updatePublishDraft:s.updatePublishDraft})));
 const available=completed.current||((!isolated||owner.current===userId)&&(resumeId===null||!!initial.current)&&(!reference||!!matchingSavedDraft(table,reference,userId)));
 const active=useCallback(()=>{const s=window.__OS__?.getState(),top=s?.tasks.find(t=>t.taskId===s.activeTaskId)?.stack.at(-1),u=useRedBookStore.getState();return !!s&&!s.isLauncherVisible&&!s.isRecentsVisible&&top?.activityId===id&&(!isolated||u.user.id===owner.current)&&(!current.current||!!matchingSavedDraft(u.savedPublishDrafts,current.current,u.user.id))&&(resumeId===null||!!initial.current);},[id,isolated,resumeId]);
 const update=useCallback((patch:Partial<RedBookPublishDraft>)=>{if(!active())return;if(!isolated){useRedBookStore.getState().updatePublishDraft(patch);return;}setDraft(before=>Object.entries(patch).every(([key,value])=>before[key as keyof RedBookPublishDraft]===value)?before:{...before,...patch,...(patch.images?{images:[...patch.images]}:{})});},[active,isolated]);
 const save=useCallback((patch:Partial<RedBookPublishDraft>)=>{if(!active())return false;const body={...(isolated?draft:useRedBookStore.getState().publishDraft),...patch};const saved=useRedBookStore.getState().saveTextDraft(body,current.current);if(!saved)return false;current.current=saved;setReference(saved);return true;},[active,isolated,draft]);
 const publish=useCallback((data:Pick<Note,'title'|'content'|'images'>)=>{if(!active())return false;completed.current=true;try{const ok=useRedBookStore.getState().publishTextDraft(data,current.current);if(!ok)completed.current=false;else{current.current=null;setReference(null);}return ok;}catch(e){completed.current=false;throw e;}},[active]);
 const finish=useCallback(()=>{const s=window.__OS__?.getState(),top=s?.tasks.find(t=>t.taskId===s.activeTaskId)?.stack.at(-1);if(!s||s.isLauncherVisible||s.isRecentsVisible||top?.activityId!==id)return;if(external)window.__OS__?.finishActivity();else if(resumeId&&!memoryHistoryPopToFirstMatch(navigator,['/publish/drafts']))navigate('/publish/drafts',{replace:true});},[id,external,resumeId,navigator,navigate]);
 const value={external,isolated,resumed:resumeId!==null,publishDraft:isolated?draft:global.publishDraft,updatePublishDraft:update,save,publish,finish};
 return <Context.Provider value={value}>{available||!location.pathname.startsWith('/publish/text')?children:<Unavailable/>}</Context.Provider>;
}
export function PublishDraftSession({children}:{children:React.ReactNode}){
 const id=useActivityId(),location=useLocation();const seed=useMemo(()=>redBookShareSeed(id?window.__OS__?.getIntentPayload(id):null),[id]);
 const ids=new URLSearchParams(location.search).getAll('draftId'),resumeId=!seed.external&&location.pathname.startsWith('/publish/text')&&ids.length?ids.length===1?ids[0]:'':null;
 return <Scope key={id+'|'+(seed.external?'incoming':resumeId===null?'normal':'saved:'+resumeId)} external={seed.external} resumeId={resumeId}>{children}</Scope>;
}
export function usePublishDraftSession(){const value=useContext(Context);if(!value)throw new Error('Publish draft session provider missing');return value;}
