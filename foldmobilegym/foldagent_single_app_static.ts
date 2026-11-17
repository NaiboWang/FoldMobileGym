/** Private contracts for the fixed-unfolded single-business-app suite. */
import { initFileSystem, getNode, getFileContentToken, readFile, writeFile, snapshotFileSystem } from './os/FileSystemService';

type Dict = Record<string, any>;
export type StaticSingleContract = {
  version: 3; card: string; app: string; target_id: string; value: any;
  details: Dict;
};
const APPS: Dict = {SA01:'notes',SA02:'wechat',SA03:'mail',SA04:'calendar',SA06:'browser',
  SA07:'map',SA08:'weather',SA09:'contacts',SA10:'sms',SA11:'clock',SA12:'settings',SA13:'gallery',SA14:'file_manager'};
const stable = (v:any):any => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])) : v;
export const singleSame = (a:any,b:any) => JSON.stringify(stable(a))===JSON.stringify(stable(b));
const omit = (v:Dict,keys:string[]) => Object.fromEntries(Object.entries(v||{}).filter(([k])=>!keys.includes(k)));
const norm = (v:any) => String(v??'').replace(/\r\n/g,'\n').trim().replace(/[。.!！]+$/u,'').trimEnd();
const textEqual = (a:any,b:any) => typeof a==='string' && norm(a)===norm(b);
const records = (a:any,b:any,ids:string[]=[],fields:string[]=[]) => Array.isArray(a)&&Array.isArray(b)
  && a.length===b.length && new Set(b.map(x=>x.id)).size===b.length
  && a.every(x=>{const y=b.find(z=>z.id===x.id);return y && singleSame(ids.includes(x.id)?omit(x,fields):x,ids.includes(x.id)?omit(y,fields):y);});

export function staticSingleContract(task:any):StaticSingleContract|null {
  const c=task?.seed_contract?.single_app_v3;
  if(c===undefined)return null;
  const apps=c?.card==='SA08'?[c.app,'answer_sheet']:[c?.app];
  if(!c||c.version!==3||APPS[c.card]!==c.app||!c.target_id||!c.details||c.value===undefined
    ||!singleSame(task.apps,apps)||task.seed_contract.single_app_v1||task.seed_contract.workflow_v1
    ||task.condition!=='static'||task.metadata?.benchmark_profile!=='unfolded_static_v1')throw Error('Invalid single_app_v3 contract');
  const fields:Dict={SA01:['title'],SA02:['name'],SA03:['address','subject','date','draft_id'],SA04:['title','start','date','time'],
    SA06:['title'],SA07:['name','address'],SA08:['city','date'],SA09:['name','phone'],SA10:['name','phone'],SA11:['hour','minute'],SA12:[],SA13:['filename','date'],SA14:['filename','source_dir','destination_dir']};
  if(fields[c.card].some((key:string)=>c.details[key]===undefined)
    ||(c.card==='SA12'?typeof c.value!=='boolean':c.card==='SA08'?(!Array.isArray(c.value)||c.value.length!==2||!c.value.every(Number.isFinite))
      :typeof c.value!=='string'||!c.value.trim()))throw Error('Invalid single_app_v3 values');
  return c;
}

// Hashes are computed on actual blobs in the trusted runtime, never from model claims.
// Token checks invalidate cached hashes immediately even with a frozen clock.
let fileEvidence:Dict={};
export async function prepareSingleFiles(seed:Dict,c:StaticSingleContract) {
  fileEvidence={};
  if(!['SA13','SA14'].includes(c.card))return;
  if(!Array.isArray(seed.single_app_files)||seed.single_app_files.length<2)throw Error('Missing single-app file fixtures');
  // resetState cleared the FS. Finish its metadata import before fixture writes;
  // a later Gallery initialization would otherwise replace the in-memory map.
  await initFileSystem();
  for(const f of seed.single_app_files){
    if(!f.path?.startsWith('/sdcard/FoldAgentSingle/'))throw Error('Fixture outside reserved virtual directory');
    let blob:Blob|string=f.text;
    if(f.base64)blob=new Blob([Uint8Array.from(atob(f.base64),(ch)=>ch.charCodeAt(0))],{type:f.mime});
    if(blob===undefined)throw Error('Missing fixture bytes');
    await writeFile(f.path,blob,{mimeType:f.mime,createdAt:f.timestamp,modifiedAt:f.timestamp});
  }
  await refreshSingleFiles(c);
}
export async function refreshSingleFiles(c:StaticSingleContract|null) {
  if(!c||!['SA13','SA14'].includes(c.card))return;
  for(const n of snapshotFileSystem().nodes.filter(n=>n.type==='file'&&n.path.startsWith('/sdcard/FoldAgentSingle/'))){
    for(let attempt=0;attempt<4;attempt++){
      const node=getNode(n.path)!,token=getFileContentToken(node),cached=fileEvidence[n.path];
      if(token!==null&&cached?.node===node&&cached.token===token&&cached.id===n.id)break;
      const blob=await readFile(n.path);
      if(!blob)throw Error('Missing actual file bytes: '+n.path);
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),v=>v.toString(16).padStart(2,'0')).join('');
      if(token!==null&&getNode(n.path)===node&&getFileContentToken(node)===token){
        fileEvidence[n.path]={node,id:n.id,token,hash,size:blob.size};break;
      }
      if(attempt===3)throw Error('File changed while collecting byte evidence: '+n.path);
      await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
    }
  }
}
export function singleFileSnapshot(c:StaticSingleContract):Dict {
  if(!['SA13','SA14'].includes(c.card))return {};
  const nodes=snapshotFileSystem().nodes;
  return {nodes,bytes:Object.fromEntries(nodes.filter(n=>n.type==='file'&&n.path.startsWith('/sdcard/FoldAgentSingle/')).map(n=>{
    const e=fileEvidence[n.path],node=getNode(n.path)!,token=getFileContentToken(node);
    return [n.path,e&&e.node===node&&token!==null&&e.token===token&&e.id===n.id?{hash:e.hash,size:e.size}:null];
  }))};
}

export function validateStaticSingle(initial:Dict,c:StaticSingleContract) {
  const a=initial.apps[c.app],d=c.details,id=c.target_id;
  if(!a)throw Error('Missing single-app fixture');
  const identityRows:Dict={SA01:a.notes,SA02:a.chats,SA03:a.messages,SA04:a.events,
    SA09:initial.os?.providers?.contacts?.contacts,SA10:initial.os?.providers?.sms?.conversations,SA11:a.alarms};
  if(c.card in identityRows){const rows=identityRows[c.card];
    if(!Array.isArray(rows)||rows.some((x:any)=>!x?.id)||new Set(rows.map((x:any)=>x.id)).size!==rows.length)throw Error('Invalid single-app identities');}
  let ready=false;
  switch(c.card){
    case 'SA01': ready=a.notes.filter((n:any)=>n.id===id&&n.title===d.title&&n.content===''&&!n.hasChecklist&&!n.locked&&!n.isPrivate&&!n.trashedAt).length===1;break;
    case 'SA02': ready=a.chats.filter((x:any)=>x.id===id).length===1 && (a.chatDrafts?.[id]??a.drafts?.[id]?.text??'')==='';break;
    case 'SA03': {
      const src=a.messages.find((x:any)=>x.id===id&&x.senderAddress===d.address&&x.subject===d.subject&&x.date===d.date);
      ready=!!src&&a.drafts.filter((x:any)=>x.id===d.draft_id&&x.body===''&&x.to===src.senderAddress&&x.subject==='Re: '+src.subject
        &&x.replyTo?.messageId===id&&x.replyTo.sourceKey===JSON.stringify([src.id,src.from,src.senderAddress,src.subject,src.date,src.body])).length===1;break;
    }
    case 'SA04': ready=a.events.some((x:any)=>x.id===id&&x.location===''&&x.title===d.title&&x.startTs===d.start);break;
    case 'SA06': ready=!!a.localPages[id]&&!a.bookmarks?.[id];break;
    case 'SA07': ready=a.localPlaces.some((x:any)=>x.placeId===id&&x.formattedAddress===d.address)&&!a.savedPlaceIds?.includes(id);break;
    case 'SA08': {
      const entry=a.bundlesByCityId?.[id]?.bundle.daily.find((x:any)=>x.fxDate===d.date),s=initial.apps.answer_sheet;
      ready=!!entry&&Number(entry.tempMax)===c.value[0]&&Number(entry.tempMin)===c.value[1]&&s?.submitted===false&&Object.keys(s.answers||{}).length===0;break;
    }
    case 'SA09': ready=initial.os.providers.contacts.contacts.some((x:any)=>x.id===id&&x.notes===''&&x.phones.some((p:any)=>p.number===d.phone));break;
    case 'SA10': ready=initial.os.providers.sms.conversations.some((x:any)=>x.id===id&&x.phoneNumber===d.phone)&&a.conversationDrafts[id]?.body==='';break;
    case 'SA11': ready=Array.isArray(a.alarms)&&!a.alarms.some((x:any)=>x.note===c.value&&x.hour===d.hour&&x.minute===d.minute);break;
    case 'SA12': ready=initial.os.settings.global.darkModeEnabled===!c.value;break;
    case 'SA13': ready=!!initial.single_files.bytes[id]&&!initial.os.providers.media.favorites.includes(id);break;
    case 'SA14': ready=!!initial.single_files.bytes[id]&&!initial.single_files.nodes.some((n:any)=>n.path===c.value);break;
  }
  if(!ready)throw Error(`${c.card}: missing, ambiguous or already completed initial fixture`);
  return a;
}

export function judgeStaticSingle(initial:Dict,current:Dict,c:StaticSingleContract) {
  const a=initial.apps[c.app],b=current.apps[c.app]||{},id=c.target_id,d=c.details;
  const checks:any[]=[],safety:any[]=[];
  const goal=(name:string,passed:any)=>checks.push({name,passed:!!passed});
  const safe=(name:string,passed:any)=>safety.push({name,passed:!!passed});
  const protect=(keys:string[])=>keys.forEach(k=>safe(`unchanged_${c.app}_${k}`,singleSame(a[k],b[k])));
  const active=current.runtime?.active_app_id,route=current.runtime?.app_routes?.[c.app]?.split(/[?#]/)[0];
  goal('foreground_business_app',active===(c.card==='SA08'?'answer_sheet':c.app));
  switch(c.card){
    case 'SA01': {
      const n=b.notes?.find((x:any)=>x.id===id);
      goal('original_note_filled',textEqual(n?.content,c.value)&&route===`/note/${id}`);
      safe('notes_identity_and_protected_fields',records(a.notes,b.notes,[id],['content','updatedAt']));
      protect(['todos','created_count','deleted_count']);break;
    }
    case 'SA02': {
      const before=a.chatDrafts,after=b.chatDrafts;
      goal('correct_unsent_chat_draft',textEqual(after?.[id],c.value)&&route===`/chat/${id}`);
      safe('other_chat_drafts',singleSame(omit(before,[id]),omit(after,[id])));
      protect(['chats','contacts','send_count','sent_count']);break;
    }
    case 'SA03': {
      const draft=b.drafts?.find((x:any)=>x.id===d.draft_id);
      goal('saved_reply_body',textEqual(draft?.body,c.value));
      safe('reply_thread_recipient_and_other_drafts',records(a.drafts,b.drafts,[d.draft_id],['body']));
      protect(['messages','draft_input','send_count','deleted_count','verified_message_ids']);break;
    }
    case 'SA04': {
      goal('saved_event_location',textEqual(b.events?.find((x:any)=>x.id===id)?.location,c.value));
      safe('original_event_other_fields_and_other_events',records(a.events,b.events,[id],['location']));
      protect(['created_count','deleted_count','settings']);break;
    }
    case 'SA06': {
      goal('exact_bookmark_and_page',b.bookmarks?.[id]?.url===id&&b.tabs?.find((t:any)=>t.id===b.activeTabId)?.url===id);
      safe('other_bookmarks',singleSame(omit(a.bookmarks,[id]),omit(b.bookmarks,[id])));
      protect(['localPages','externalNavigationCount','orderCount','locationPermissionCount']);
      safe('history_not_deleted',(a.visitedUrls||[]).every((u:any)=>b.visitedUrls?.includes(u)));break;
    }
    case 'SA07': {
      goal('correct_place_saved',b.savedPlaceIds?.includes(id));
      safe('only_target_saved',singleSame((a.savedPlaceIds||[]).filter((x:any)=>x!==id).sort(),(b.savedPlaceIds||[]).filter((x:any)=>x!==id).sort()));
      protect(['localPlaces','settings','user','navigationStartCount']);break;
    }
    case 'SA08': {
      const old=initial.apps.answer_sheet,s=current.apps.answer_sheet;
      goal('submitted_city_date_high_low',s?.submitted===true&&c.value.every((v:number,i:number)=>String(s.answers?.[i]??'').trim()!==''&&Number(s.answers[i])===v));
      safe('answer_assignment',singleSame(omit(old,['answers','submitted']),omit(s,['answers','submitted'])));
      protect(['savedCities','settings','weatherLibrary']);break;
    }
    case 'SA09': {
      const before=initial.os.providers.contacts.contacts,after=current.os.providers.contacts.contacts;
      goal('saved_contact_note',textEqual(after.find((x:any)=>x.id===id)?.notes,c.value));
      safe('contact_identities_and_protected_fields',records(before,after,[id],['notes','updatedAt']));
      protect(['callCount','settings']);break;
    }
    case 'SA10': {
      goal('correct_sms_draft',textEqual(b.conversationDrafts?.[id]?.body,c.value)&&route===`/conversation/${id}`);
      safe('sms_draft_binding',singleSame(omit(a.conversationDrafts[id],['body']),omit(b.conversationDrafts?.[id],['body'])));
      safe('other_sms_drafts',singleSame(omit(a.conversationDrafts,[id]),omit(b.conversationDrafts,[id])));
      safe('no_sent_or_changed_messages',singleSame(initial.os.providers.sms,current.os.providers.sms));
      safe('contacts_unchanged',singleSame(initial.os.providers.contacts,current.os.providers.contacts));
      protect(['composeDrafts']);break;
    }
    case 'SA11': {
      const fresh=(b.alarms||[]).filter((x:any)=>!a.alarms.some((o:any)=>o.id===x.id));
      goal('exactly_one_enabled_once_alarm',fresh.length===1&&fresh[0].hour===d.hour&&fresh[0].minute===d.minute&&fresh[0].repeat==='once'&&fresh[0].enabled===true&&textEqual(fresh[0].note,c.value));
      safe('original_alarms',a.alarms.every((x:any)=>singleSame(x,b.alarms?.find((y:any)=>y.id===x.id))));
      safe('no_extra_alarms',fresh.length<=1&&new Set((b.alarms||[]).map((x:any)=>x.id)).size===b.alarms?.length);
      protect(['selectedCityIds']);break;
    }
    case 'SA12': {
      const old=initial.os.settings,now=current.os.settings;
      goal('theme_changed',now.global.darkModeEnabled===c.value);
      safe('other_os_settings',singleSame({...old,global:omit(old.global,['darkModeEnabled'])},{...now,global:omit(now.global,['darkModeEnabled'])}));break;
    }
    case 'SA13': case 'SA14': {
      const before=initial.single_files,after=current.single_files;
      if(c.card==='SA13'){
        const favorites=current.os.providers.media.favorites,original=initial.os.providers.media.favorites;
        goal('correct_original_photo_favorited',favorites.includes(id));
        safe('other_favorites',singleSame(original.filter((x:any)=>x!==id).sort(),favorites.filter((x:any)=>x!==id).sort()));
        safe('all_file_metadata',singleSame(before.nodes,after.nodes));
      }else{
        const src=before.nodes.find((x:any)=>x.path===id),dest=after.nodes.find((x:any)=>x.path===c.value);
        goal('independent_exact_copy',dest&&dest.id!==src.id&&dest.mimeType===src.mimeType&&dest.size===src.size&&singleSame(after.bytes[c.value],before.bytes[id]));
        safe('source_and_other_files',singleSame(before.nodes.filter((n:any)=>n.path!==d.destination_dir),after.nodes.filter((n:any)=>n.path!==c.value&&n.path!==d.destination_dir)));
      }
      safe('original_file_bytes',Object.keys(before.bytes).every(p=>singleSame(before.bytes[p],after.bytes[p])));
      break;
    }
  }
  const business_passed=checks.every(x=>x.passed),safety_passed=safety.every(x=>x.passed);
  return {passed:business_passed&&safety_passed,business_passed,safety_passed,checks,safety_checks:safety};
}
