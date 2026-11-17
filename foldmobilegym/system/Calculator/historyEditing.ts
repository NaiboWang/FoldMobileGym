import type { CalculationRecord, ExpressionCalculationRecord, HistoryEntry, HistoryId, HistoryTarget } from './types';
export const historyEntryId = (record: HistoryEntry | HistoryTarget): HistoryId => record.origin === 'expression' ? `e${record.id}` : record.id;
export function recentHistoryEntries(records: readonly CalculationRecord[], expressions: readonly ExpressionCalculationRecord[] = []): HistoryEntry[] {
  return [...records.filter(record => record.expressionId === undefined), ...expressions]
    .sort((a,b)=>(a.sequence??a.id)-(b.sequence??b.id)).slice(-32);
}
export function normalizedHiddenHistoryIds(value: unknown, records: readonly HistoryEntry[]): HistoryId[] {
  if(!Array.isArray(value))return [];
  const current=new Set(records.map(historyEntryId));
  return [...new Set(value.filter((id):id is HistoryId => ((typeof id==='number'&&Number.isSafeInteger(id)&&id>0)||(typeof id==='string'&&/^e[1-9]\d*$/.test(id)))&&current.has(id as HistoryId)))].sort((a,b)=>typeof a==='number'&&typeof b==='number'?a-b:String(a).localeCompare(String(b)));
}
export function visibleHistoryRecords(records: readonly CalculationRecord[], hidden: unknown = [], expressions: readonly ExpressionCalculationRecord[] = []): HistoryEntry[] {
  const recent=recentHistoryEntries(records,expressions), excluded=new Set(normalizedHiddenHistoryIds(hidden,recent));
  return recent.filter(record=>!excluded.has(historyEntryId(record)));
}
export function historyDeletionTargets(records: readonly HistoryEntry[]): HistoryTarget[] {
  return records.map(record=>record.origin==='expression'?{id:record.id,origin:record.origin,expression:record.expression,angleUnit:record.angleUnit,result:record.result,displayResult:record.displayResult,sequence:record.sequence,timestamp:record.timestamp}:{...record});
}
export function sameHistoryRecord(a: HistoryEntry, b: HistoryTarget) {
  if(a.origin==='expression'||b.origin==='expression')return a.origin==='expression'&&b.origin==='expression'&&a.id===b.id&&a.expression===b.expression&&a.angleUnit===b.angleUnit&&a.result===b.result&&a.displayResult===b.displayResult&&a.sequence===b.sequence&&a.timestamp===b.timestamp;
  return a.id===b.id&&a.left===b.left&&a.right===b.right&&a.operator===b.operator&&a.result===b.result&&a.displayResult===b.displayResult&&a.origin===b.origin&&a.sequence===b.sequence&&a.expressionId===b.expressionId;
}
const validTarget=(value:unknown):value is HistoryTarget=>{
 if(!value||typeof value!=='object')return false;const r=value as HistoryTarget;
 if(!Number.isSafeInteger(r.id)||r.id<=0||!(r.result===null||Number.isFinite(r.result))||typeof r.displayResult!=='string'||!r.displayResult.length||r.displayResult.length>500)return false;
 if(r.origin==='expression')return typeof r.expression==='string'&&r.expression.length<=256&&['rad','deg'].includes(r.angleUnit)&&Number.isSafeInteger(r.sequence)&&r.sequence>0&&Number.isFinite(r.timestamp);
 return Number.isFinite(r.left)&&Number.isFinite(r.right)&&['+','-','*','/'].includes(r.operator)&&['equals','chain'].includes(r.origin)&&r.expressionId===undefined;
};
export function parseHistoryDeletionTargets(raw:string|null):HistoryTarget[]{
 if(!raw||raw.length>24000)return [];try{const data:unknown=JSON.parse(raw);if(!Array.isArray(data)||data.length>32||!data.every(validTarget)||new Set(data.map(historyEntryId)).size!==data.length)return [];return data.map(record=>({...record}));}catch{return [];}
}
export function historyDeletionStillCurrent(records:readonly CalculationRecord[],hidden:unknown,targets:readonly HistoryTarget[],expressions:readonly ExpressionCalculationRecord[]=[]){
 if(!Array.isArray(targets)||!targets.length||targets.length>32||!targets.every(validTarget)||new Set(targets.map(historyEntryId)).size!==targets.length)return false;
 const visible=visibleHistoryRecords(records,hidden,expressions);return targets.every(target=>visible.some(record=>sameHistoryRecord(record,target)));
}
export function parseHistorySelection(raw:string|null,records:readonly HistoryEntry[]):HistoryId[]{
 const current=new Set(records.map(historyEntryId));return [...new Set((raw??'').split(',').filter(value=>/^(?:[1-9]\d*|e[1-9]\d*)$/.test(value)).map(value=>value.startsWith('e')?value as HistoryId:Number(value)).filter(id=>current.has(id)))].slice(0,32);
}
/** Parent reconstruction is only for first-entry overlays with missing history. */
export function calculatorHistoryParent(search:string):string|null{const current=new URLSearchParams(search),mode=current.get('history');if(mode!=='open'&&mode!=='edit')return null;if(current.get('dialog')==='deleteHistory'){const parent=new URLSearchParams({history:mode});if(mode==='edit'&&current.has('selection'))parent.set('selection',current.get('selection')!);return `/?${parent}`;}return mode==='edit'?'/?history=open':'/';}
export function isCalculatorHistoryParent(parent:string,previous:{pathname:string;search:string}|undefined){if(!previous)return false;const index=parent.indexOf('?'),pathname=index<0?parent:parent.slice(0,index);const canonical=(search:string)=>{const p=new URLSearchParams(search);p.sort();return p.toString();};return previous.pathname===pathname&&canonical(previous.search)===canonical(index<0?'':parent.slice(index+1));}
