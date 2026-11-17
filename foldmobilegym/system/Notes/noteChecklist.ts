export interface NoteChecklistItem { id: string; text: string; completed: boolean }
export interface NoteChecklistFields { hasChecklist?: boolean; checklist?: NoteChecklistItem[] }
let rowSequence=0;
const rowEpoch=globalThis.crypto?.randomUUID?.()??Math.random().toString(36).slice(2);
export const newChecklistItemId=(rows:readonly {id:string}[]=[])=>{const used=new Set(rows.map(row=>row.id));let id:string;do{id=`check.${rowEpoch}.${++rowSequence}`;}while(used.has(id));return id;};
export const cloneChecklist=(rows:readonly NoteChecklistItem[])=>rows.map(row=>({...row}));
export function validChecklist(value:unknown):value is NoteChecklistItem[]{
  return Array.isArray(value)&&value.every(row=>row&&typeof row.id==='string'&&row.id.length>0&&typeof row.text==='string'&&typeof row.completed==='boolean')
    &&new Set(value.map(row=>row.id)).size===value.length;
}
export function checklistFields(value:NoteChecklistFields):NoteChecklistFields{
  return {...(value.hasChecklist!==undefined?{hasChecklist:value.hasChecklist}:{}),...(value.checklist!==undefined?{checklist:cloneChecklist(value.checklist)}:{})};
}
export function sameChecklist(left:NoteChecklistFields,right:NoteChecklistFields){
  const a=left.checklist??[],b=right.checklist??[];
  return !!left.hasChecklist===!!right.hasChecklist&&a.length===b.length&&a.every((row,index)=>row.id===b[index].id&&row.text===b[index].text&&row.completed===b[index].completed);
}
export const authoredChecklist=(value:NoteChecklistFields)=>!!value.checklist?.some(row=>row.text.trim().length>0);
/** Tail insertion is explicit; an old missing row must never resurrect itself. */
export function changeChecklistText(rows:readonly NoteChecklistItem[],id:string,text:string,tail=false){
  const index=rows.findIndex(row=>row.id===id);
  if(index<0&&!tail)return null;
  if(index<0&&!text)return cloneChecklist(rows);
  const parts=text.replace(/\r\n?/g,'\n').split('\n');
  while(parts.length>1&&parts.at(-1)==='')parts.pop();
  const first=index>=0?rows[index]:{id,text:'',completed:false};
  const inserts=[{...first,text:parts[0]}];
  for(const value of parts.slice(1))inserts.push({id:newChecklistItemId([...rows,...inserts]),text:value,completed:false});
  const next=cloneChecklist(rows);next.splice(index<0?next.length:index,index<0?0:1,...inserts);return next;
}
