import type {RedBookPublishDraft} from '../types';
import * as TimeService from '../../../os/TimeService';
const validTime=(t:number)=>Number.isFinite(t)&&Number.isFinite(TimeService.fromTimestamp(t).getTime());
export type SavedDraftRef={id:string;revision:number};
export type SavedPublishDraft=RedBookPublishDraft&SavedDraftRef&{ownerId:string;updatedAt:number};
export type SavedPublishDrafts=Record<string,SavedPublishDraft>;
export function copyPublishDraft(d:RedBookPublishDraft):RedBookPublishDraft{return {text:d.text,title:d.title,templateId:d.templateId,images:[...d.images]};}
export function ownedSavedDraft(table:SavedPublishDrafts|undefined,id:string,owner:string):SavedPublishDraft|undefined{
 if(!id||!table||!Object.hasOwn(table,id))return;
 const d=table[id];
 if(!d||d.id!==id||d.ownerId!==owner||!Number.isSafeInteger(d.revision)||d.revision<1||!validTime(d.updatedAt)||typeof d.text!=='string'||typeof d.title!=='string'||typeof d.templateId!=='string'||!Array.isArray(d.images)||d.images.some(i=>typeof i!=='string'))return;
 return d;
}
export function matchingSavedDraft(table:SavedPublishDrafts|undefined,ref:SavedDraftRef,owner:string):SavedPublishDraft|undefined{const d=ownedSavedDraft(table,ref.id,owner);return d?.revision===ref.revision?d:undefined;}
export function listOwnedSavedDrafts(table:SavedPublishDrafts|undefined,owner:string):SavedPublishDraft[]{return Object.keys(table||{}).map(id=>ownedSavedDraft(table,id,owner)).filter((d):d is SavedPublishDraft=>!!d).sort((a,b)=>b.updatedAt-a.updatedAt||a.id.localeCompare(b.id));}
export function putSavedDraft(table:SavedPublishDrafts|undefined,owner:string,draft:RedBookPublishDraft,now:number,ref?:SavedDraftRef|null):{table:SavedPublishDrafts;ref:SavedDraftRef}|null{
 if(!owner||!validTime(now)||(!draft.text.trim()&&!draft.title.trim()&&!draft.images.length))return null;
 let id=ref?.id,revision=1;
 if(ref){const d=matchingSavedDraft(table,ref,owner);if(!d||d.revision>=Number.MAX_SAFE_INTEGER)return null;revision=d.revision+1;}
 if(!id){const base='draft_'+now;id=base;let suffix=0;while(Object.hasOwn(table||{},id))id=base+'_'+(++suffix);}
 const next={id,revision};return {table:{...table,[id]:{...copyPublishDraft(draft),...next,ownerId:owner,updatedAt:now}},ref:next};
}
export function withoutSavedDraft(table:SavedPublishDrafts|undefined,id:string):SavedPublishDrafts|undefined{const next={...table};delete next[id];return Object.keys(next).length?next:undefined;}
