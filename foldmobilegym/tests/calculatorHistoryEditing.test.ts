import { beforeEach, describe, expect, it } from 'vitest';
import { resetAllAppStores } from '../os/createAppStore';
import { CALCULATOR_CONFIG } from '../system/Calculator/data';
import { useCalculatorStore } from '../system/Calculator/state';
import { getCalculationHistoryRows } from '../system/Calculator/historyPresentation';
import { calculatorHistoryParent, isCalculatorHistoryParent, historyDeletionStillCurrent, normalizedHiddenHistoryIds, parseHistoryDeletionTargets, parseHistorySelection } from '../system/Calculator/historyEditing';
import { ownsHistoryDeletion, type HistoryOwnerState } from '../system/Calculator/historyOwnership';
import type { CalculationRecord } from '../system/Calculator/types';
const record = (id: number, patch: Partial<CalculationRecord> = {}): CalculationRecord => ({id,left:id,right:2,operator:'+',result:id+2,displayResult:String(id+2),origin:'equals',...patch});
const records = [record(1),record(2),record(3)];

describe('History deletion request/data boundary',()=>{
 it('does not pop a bare home entry instead of a missing overlay parent',()=>{expect(isCalculatorHistoryParent('/?history=edit&selection=1',{pathname:'/',search:''})).toBe(false);});
 it('recognizes real prior overlay state regardless of query order/encoding',()=>{expect(isCalculatorHistoryParent('/?history=edit&selection=1%2C2',{pathname:'/',search:'?selection=1,2&history=edit'})).toBe(true);});
 it('rejects missing or different prior states',()=>{expect(isCalculatorHistoryParent('/?history=open',undefined)).toBe(false);expect(isCalculatorHistoryParent('/?history=open',{pathname:'/',search:'?history=edit'})).toBe(false);});
 it('recognizes the actual bare home parent',()=>expect(isCalculatorHistoryParent('/',{pathname:'/',search:''})).toBe(true));
 it('filters visible records without mutating the original evidence',()=>{const source=structuredClone(records);expect(getCalculationHistoryRows(source,[2]).map(r=>r.id)).toEqual([3,1]);expect(source).toEqual(records);});
 it('deduplicates/prunes invalid and no-longer-retained hidden ids',()=>{expect(normalizedHiddenHistoryIds([3,3,1,0,-1,1.5,99,'2',null],records)).toEqual([1,3]);expect(normalizedHiddenHistoryIds({},records)).toEqual([]);});
 it('parses only bounded, strict snapshots',()=>{expect(parseHistoryDeletionTargets(JSON.stringify(records))).toEqual(records);for(const raw of ['', 'broken', '{}','[null]',JSON.stringify([record(1),record(1)]),JSON.stringify(Array.from({length:33},(_,i)=>record(i+1))),JSON.stringify([record(1,{displayResult:''})])])expect(parseHistoryDeletionTargets(raw)).toEqual([]);});
 it('accepts unchanged selected records even when a newer unseen record exists',()=>{expect(historyDeletionStillCurrent([...records,record(4)],[],[records[0]])).toBe(true);});
 it('rejects changed same-id records rather than deleting replacements',()=>{expect(historyDeletionStillCurrent([record(1,{left:99}),record(2)],[],[records[0]])).toBe(false);});
 it('rejects hidden, missing, duplicate, malformed and empty targets atomically',()=>{for(const targets of [[],[record(99)],[record(1),record(1)],[record(1),record(99)]])expect(historyDeletionStillCurrent(records,[],targets)).toBe(false);expect(historyDeletionStillCurrent(records,[1],[records[0]])).toBe(false);});
 it('parses selection as existing positive safe IDs only',()=>{expect(parseHistorySelection('2,1,2,0,-3,bad,999,1.5',records)).toEqual([2,1]);});
 it('has explicit initial-route Back parents',()=>{expect(calculatorHistoryParent('?history=edit&selection=2&dialog=deleteHistory&targets=invalid')).toBe('/?history=edit&selection=2');expect(calculatorHistoryParent('?history=open&dialog=deleteHistory')).toBe('/?history=open');expect(calculatorHistoryParent('?history=edit')).toBe('/?history=open');expect(calculatorHistoryParent('?history=open')).toBe('/');expect(calculatorHistoryParent('')).toBeNull();});
});

describe('Visible deletion does not alter arithmetic/evaluation evidence',()=>{
 beforeEach(()=>useCalculatorStore.setState({...structuredClone(CALCULATOR_CONFIG),hiddenHistoryRecordIds:undefined}));
 const fill=()=>useCalculatorStore.setState({calculations:structuredClone(records),calculationCount:3,display:'2',firstOperand:9,operator:'+',waitingForSecondOperand:false});
 it('records only visibility metadata and resumes pending 9+2 exactly',()=>{fill();const before=JSON.parse(JSON.stringify(useCalculatorStore.getState()));expect(useCalculatorStore.getState().deleteHistoryRecords([records[1]])).toBe(true);const after=JSON.parse(JSON.stringify(useCalculatorStore.getState()));expect(after.hiddenHistoryRecordIds).toEqual([2]);delete after.hiddenHistoryRecordIds;expect(after).toEqual(before);useCalculatorStore.getState().calculate();expect(useCalculatorStore.getState().display).toBe('11');expect(useCalculatorStore.getState().calculationCount).toBe(4);});
 it('clears visible history but not the journal, counter or AC counter',()=>{fill();const before=useCalculatorStore.getState();expect(before.deleteHistoryRecords(records)).toBe(true);const after=useCalculatorStore.getState();expect(getCalculationHistoryRows(after.calculations,after.hiddenHistoryRecordIds)).toEqual([]);expect(after.calculations).toEqual(before.calculations);expect(after.calculationCount).toBe(before.calculationCount);expect(after.clearCount).toBe(before.clearCount);});
 it('does not delete newer records absent from the confirmed snapshot',()=>{fill();useCalculatorStore.getState().calculate();expect(useCalculatorStore.getState().deleteHistoryRecords(records)).toBe(true);const after=useCalculatorStore.getState();expect(getCalculationHistoryRows(after.calculations,after.hiddenHistoryRecordIds).map(r=>r.id)).toEqual([4]);});
 it('rejects a stale snapshot without introducing optional metadata',()=>{fill();useCalculatorStore.setState({calculations:[record(1,{left:99}),record(2),record(3)]});const before=JSON.stringify(useCalculatorStore.getState());expect(useCalculatorStore.getState().deleteHistoryRecords([record(1)])).toBe(false);expect(JSON.stringify(useCalculatorStore.getState())).toBe(before);});
 it('rejects a partially stale multi-delete without removing the remaining valid record',()=>{fill();expect(useCalculatorStore.getState().deleteHistoryRecords([record(1),record(99)])).toBe(false);expect(useCalculatorStore.getState().hiddenHistoryRecordIds).toBeUndefined();});
 it('preserves removal after JSON reload, and keeps new operations visible',()=>{fill();useCalculatorStore.getState().deleteHistoryRecords([record(2)]);const saved=JSON.parse(JSON.stringify(useCalculatorStore.getState()));useCalculatorStore.setState(saved);useCalculatorStore.getState().calculate();const after=useCalculatorStore.getState();expect(after.hiddenHistoryRecordIds).toEqual([2]);expect(getCalculationHistoryRows(after.calculations,after.hiddenHistoryRecordIds).map(r=>r.id)).toEqual([4,3,1]);});
 it('bounds visibility metadata as old journal entries roll out',()=>{fill();useCalculatorStore.getState().deleteHistoryRecords(records);for(let i=0;i<40;i++){const s=useCalculatorStore.getState();s.clear();s.inputKey('1');s.selectOperator('+');s.inputKey('2');s.calculate();}const after=useCalculatorStore.getState();expect(after.calculations).toHaveLength(32);expect(after.hiddenHistoryRecordIds).toEqual([]);expect(after.calculationCount).toBe(43);});
 it('clears deletion visibility through the actual platform reset before a new research task',()=>{fill();useCalculatorStore.getState().deleteHistoryRecords(records);resetAllAppStores();expect(useCalculatorStore.getState().hiddenHistoryRecordIds).toBeUndefined();const s=useCalculatorStore.getState();s.inputKey('1');s.selectOperator('+');s.inputKey('2');s.calculate();const next=useCalculatorStore.getState();expect(next.calculationCount).toBe(1);expect(getCalculationHistoryRows(next.calculations,next.hiddenHistoryRecordIds).map(r=>r.id)).toEqual([1]);});
 it('does not fabricate optional state for ordinary legacy calculations',()=>{const s=useCalculatorStore.getState();s.inputKey('1');s.selectOperator('+');s.inputKey('2');s.calculate();expect(useCalculatorStore.getState().hiddenHistoryRecordIds).toBeUndefined();});
});

describe('Destructive history commands belong to a live foreground Activity and route',()=>{
 const owner={alive:true,taskId:'a',activityId:'aa',href:'/?history=edit&dialog=deleteHistory'};
 const current:HistoryOwnerState={activeTaskId:'a',isLauncherVisible:false,isRecentsVisible:false,tasks:[{taskId:'a',stack:[{activityId:'aa'}]}]};
 it('permits the current visible owner',()=>expect(ownsHistoryDeletion(owner,current,owner.href)).toBe(true));
 it('revokes canceled/destroyed commands even if identical URL is reopened',()=>expect(ownsHistoryDeletion({...owner,alive:false},current,owner.href)).toBe(false));
 it('rejects background task ownership',()=>expect(ownsHistoryDeletion(owner,{...current,activeTaskId:'b'},owner.href)).toBe(false));
 it('rejects Recents even while the active task id is retained',()=>expect(ownsHistoryDeletion(owner,{...current,isRecentsVisible:true},owner.href)).toBe(false));
 it('rejects Home without a matching visible floating task',()=>expect(ownsHistoryDeletion(owner,{...current,isLauncherVisible:true},owner.href)).toBe(false));
 it('allows the active non-minimized floating owner over the desktop',()=>expect(ownsHistoryDeletion(owner,{...current,isLauncherVisible:true},owner.href,'a')).toBe(true));
 it('rejects a different Activity on the same task',()=>expect(ownsHistoryDeletion(owner,{...current,tasks:[{taskId:'a',stack:[{activityId:'aa'},{activityId:'ab'}]}]},owner.href)).toBe(false));
 it('rejects a changed route before React commits a new handler',()=>expect(ownsHistoryDeletion(owner,current,'/?history=open')).toBe(false));
});
