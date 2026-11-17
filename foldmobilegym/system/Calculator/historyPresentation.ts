import type { CalculationRecord, ExpressionCalculationRecord } from './types';
import { historyEntryId, visibleHistoryRecords } from './historyEditing';
export function historyDateLabel(date: Date, now: Date, locale: string, undated: string): string {
 if (!Number.isFinite(date.getTime())) return undated;
 const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' };
 if (!Number.isFinite(now.getTime()) || date.getFullYear() !== now.getFullYear()) options.year = 'numeric';
 return date.toLocaleDateString(locale, options);
}
export function historyDateKey(date: Date): string {
 return Number.isFinite(date.getTime()) ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` : 'undated';
}
export function getCalculationHistoryRows(records: readonly CalculationRecord[],hidden:unknown=[],expressions:readonly ExpressionCalculationRecord[]=[]){
 const operators={'+':'+','-':'−','*':'×','/':'÷'} as const;const operand=(n:number)=>n<0?`(${n})`:String(n);
 return visibleHistoryRecords(records,hidden,expressions).reverse().map(record=>({id:historyEntryId(record),expression:record.origin==='expression'?record.expression:`${operand(record.left)} ${operators[record.operator]} ${operand(record.right)}`,result:record.displayResult,timestamp:record.origin==='expression'?record.timestamp:undefined}));
}
