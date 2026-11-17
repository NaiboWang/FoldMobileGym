import React from 'react';
import {useSearchParams} from 'react-router-dom';
import {useRedBookStore} from '../../state';
import {useRedBookStrings} from '../../hooks/useRedBookStrings';
import {useRedBookGestures} from '../../hooks/useRedBookGestures';
import {useRedBookPublication} from '../../hooks/useRedBookPublication';
import {listOwnedSavedDrafts,matchingSavedDraft} from '../../utils/savedPublishDrafts';
import * as TimeService from '../../../../os/TimeService';
import {useLocale} from '../../locale';
export function SavedPublishDraftsPage(){
 const s=useRedBookStrings(),locale=useLocale(),[query]=useSearchParams(),{bindTap,bindBack,back}=useRedBookGestures(),lease=useRedBookPublication();
 const table=useRedBookStore(state=>state.savedPublishDrafts),user=useRedBookStore(state=>state.user.id),remove=useRedBookStore(state=>state.deleteTextDraft);
 const rows=listOwnedSavedDrafts(table,user),dialog=query.get('dialog')==='delete',ids=query.getAll('draftId'),versions=query.getAll('revision');
 const ref={id:ids.length===1?ids[0]:'',revision:versions.length===1?Number(versions[0]):NaN},target=matchingSavedDraft(table,ref,user);
 return <div className="h-full relative bg-app-surface flex flex-col" data-redbook-draft-list>
  <div className="h-full flex flex-col" inert={dialog} aria-hidden={dialog||undefined}>
   <header className="pt-10 p-4 flex items-center gap-4"><button {...bindBack()} className="p-2 text-app-primary">{s.cancel}</button><h1 className="text-xl font-semibold">{s.my_drafts}</h1></header>
   <div className="flex-1 min-h-0 overflow-auto p-4" data-scroll-container="main" data-scroll-direction="vertical">
    {!rows.length&&<p className="p-4 text-app-text-muted">{s.saved_drafts_empty}</p>}
    {rows.map(d=><article key={d.id} data-saved-draft-id={d.id} className="mb-3 rounded-xl border border-app-border p-4">
     <button className="w-full text-left p-2" {...bindTap('publish.drafts.item.open',{params:{draftId:d.id}})}><strong className="block break-words">{d.title.trim()||d.text.split(/\r?\n/).find(t=>t.trim())||s.saved_draft_untitled}</strong><time className="text-sm text-app-text-muted">{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(TimeService.fromTimestamp(d.updatedAt))}</time></button>
     <button className="p-2 text-app-primary" {...bindTap('publish.drafts.delete.open',{params:{draftId:d.id,revision:d.revision}})}>{s.saved_draft_delete}</button>
    </article>)}
   </div>
  </div>
  {dialog&&<div className="absolute inset-0 bg-black/35 flex items-center justify-center p-4" data-redbook-draft-delete><section role="dialog" aria-modal="true" aria-label={s.saved_draft_delete} className="bg-app-surface rounded-2xl p-5 max-w-full w-80"><p className="mb-4">{target?s.saved_draft_delete_confirm:s.saved_draft_unavailable}</p><div className="flex justify-end gap-3"><button {...bindBack()} className="p-3">{s.cancel}</button><button className="p-3 text-app-primary disabled:opacity-40" disabled={!target} {...bindTap({kind:'action',id:'publish.drafts.delete.confirm.submit'},{onTrigger:()=>{if(!lease.commit(()=>{if(remove(ref))back();}))return;}})}>{s.saved_draft_delete}</button></div></section></div>}
 </div>;
}
