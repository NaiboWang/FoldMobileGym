import { createAppStoreWithActions } from '../../os/createAppStore';
import { CALCULATOR_CONFIG } from './data';
import { historyDeletionStillCurrent, normalizedHiddenHistoryIds, recentHistoryEntries, historyEntryId } from './historyEditing';
import type { CalculatorState, CalculatorOperator, CalculationRecord, HistoryTarget, ExpressionCalculationRecord } from './types';

import { evaluateExpression, formatExpressionNumber, MAX_EXPRESSION_LENGTH } from './expressionEngine';
import { initialExpressionEditor, editExpressionText } from './expressionEditing';
import * as TimeService from '../../os/TimeService';

interface CalculatorActions {
  toggleScientific: () => void;
  setExpression: (text: string) => void;
  submitExpression: () => void;
  clearExpression: () => void;
  toggleAngle: () => void;
  toggleInverse: () => void;
  memoryExpression: (command: 'MC' | 'M+' | 'M-') => void;
  inputKey: (key: string) => void;
  selectOperator: (operator: CalculatorOperator) => void;
  calculate: () => void;
  clear: () => void;
  toggleSign: () => void;
  percent: () => void;
  deleteHistoryRecords: (targets: readonly HistoryTarget[]) => boolean;
}

const formatNumber = (value: number) => {
  if (!Number.isFinite(value)) return 'Error';
  const rounded = Number(value.toPrecision(10));
  return Number.isFinite(rounded) ? rounded.toString() : 'Error';
};

function calculateRecord(state: CalculatorState, origin: CalculationRecord['origin']) {
  const left = state.firstOperand!;
  const right = Number(state.display);
  const operator = state.operator!;
  const value = operator === '+' ? left + right : operator === '-' ? left - right
    : operator === '*' ? left * right : right === 0 ? NaN : left / right;
  const displayResult = formatNumber(value);
  const sequence = state.expressionEditor ? Math.max(state.expressionEditor.sequence,state.calculationCount)+1 : undefined;
  const record: CalculationRecord = {
    id: state.calculationCount + 1, left, right, operator,
    result: displayResult === 'Error' ? null : Number(displayResult), displayResult, origin,
    ...(sequence === undefined ? {} : { sequence }),
  };
  const calculations = [...state.calculations, record].slice(-32);
  return {
    display: displayResult,
    ...(sequence === undefined ? {} : {expressionEditor:{...state.expressionEditor!,sequence}}),
    calculationCount: record.id,
    // Recent development evidence only, not an unlimited trajectory recorder.
    calculations,
    ...(state.hiddenHistoryRecordIds === undefined ? {} : {
      hiddenHistoryRecordIds: normalizedHiddenHistoryIds(state.hiddenHistoryRecordIds, recentHistoryEntries(calculations,state.expressionEditor?.records)),
    }),
  };
}

export const useCalculatorStore = createAppStoreWithActions<CalculatorState, CalculatorActions>(
  // Platform reset shallow-merges initial values; clear optional visibility too.
  'calculator', { ...CALCULATOR_CONFIG, hiddenHistoryRecordIds: undefined, expressionEditor: undefined },
  (set) => ({
    toggleScientific: () => set(state => ({ expressionEditor: state.expressionEditor ? { ...state.expressionEditor, showScientific: !state.expressionEditor.showScientific } : initialExpressionEditor(state) })),
    setExpression: text => {
      if (text.length > MAX_EXPRESSION_LENGTH) return;
      set(state => { const editor=editExpressionText(state.expressionEditor??initialExpressionEditor(state),text); const preview=evaluateExpression(text,editor.angleUnit); return { expressionEditor:editor, display:preview.kind==='success'?preview.display:'',firstOperand:null,operator:null,waitingForSecondOperand:false }; });
    },
    clearExpression: () => set(state=>({expressionEditor:editExpressionText(state.expressionEditor??initialExpressionEditor(state),''),display:'0',firstOperand:null,operator:null,waitingForSecondOperand:false,clearCount:state.clearCount+1})),
    toggleAngle: () => set(state=>{const editor=state.expressionEditor??initialExpressionEditor(state);const next={...editor,angleUnit:editor.angleUnit==='rad'?'deg' as const:'rad' as const,error:null,lastResult:null,justEvaluated:false};const preview=evaluateExpression(next.expression,next.angleUnit);return {expressionEditor:next,display:preview.kind==='success'?preview.display:''};}),
    toggleInverse: () => set(state=>{const editor=state.expressionEditor??initialExpressionEditor(state);return {expressionEditor:{...editor,inverse:!editor.inverse}};}),
    memoryExpression: command => set(state=>{const editor=state.expressionEditor??initialExpressionEditor(state);if(command==='MC')return {expressionEditor:{...editor,memory:null}};const result=evaluateExpression(editor.expression,editor.angleUnit);if(result.kind!=='success')return {};const memory=(editor.memory??0)+(command==='M+'?Number(result.display):-Number(result.display));return Number.isFinite(memory)?{expressionEditor:{...editor,memory:Number(formatExpressionNumber(memory))}}:{expressionEditor:{...editor,error:'overflow'},display:'Error'};}),
    submitExpression: () => set(state=>{
      const editor=state.expressionEditor??initialExpressionEditor(state),result=evaluateExpression(editor.expression,editor.angleUnit);
      if(result.kind==='empty')return {};
      if(result.kind==='error'&&!result.validExpression)return {expressionEditor:{...editor,error:result.error,justEvaluated:false},display:'Error'};
      const id=editor.count+1,sequence=Math.max(editor.sequence,state.calculationCount)+1;
      const record:ExpressionCalculationRecord={id,origin:'expression',expression:editor.expression,angleUnit:editor.angleUnit,result:result.kind==='success'?result.value:null,displayResult:result.kind==='success'?result.display:'Error',sequence,timestamp:TimeService.now(),operations:result.operations};
      let count=state.calculationCount;const evidence:CalculationRecord[]=[];
      const binary=result.operations.filter(op=>op.kind==='binary'&&['+','-','*','/'].includes(op.operator));
      binary.forEach(op=>{if(op.kind!=='binary'||op.operator==='^')return;evidence.push({id:++count,left:op.left,right:op.right,operator:op.operator,result:op.result===null?null:Number(formatExpressionNumber(op.result)),displayResult:op.result===null?'Error':formatExpressionNumber(op.result),origin:op===result.operations.at(-1)?'equals':'chain',expressionId:id});});
      const calculations=[...state.calculations,...evidence].slice(-32),records=[...editor.records,record].slice(-32);
      return {expressionEditor:{...editor,records,count:id,sequence,error:result.kind==='error'?result.error:null,lastResult:record.displayResult,justEvaluated:true},display:record.displayResult,firstOperand:null,operator:null,waitingForSecondOperand:true,calculationCount:count,calculations,...(state.hiddenHistoryRecordIds===undefined?{}:{hiddenHistoryRecordIds:normalizedHiddenHistoryIds(state.hiddenHistoryRecordIds,recentHistoryEntries(calculations,records))})};
    }),
    deleteHistoryRecords: targets => {
      let applied = false;
      set(state => {
        if (!historyDeletionStillCurrent(state.calculations, state.hiddenHistoryRecordIds, targets, state.expressionEditor?.records)) return {};
        applied = true;
        return { hiddenHistoryRecordIds: normalizedHiddenHistoryIds([
          ...normalizedHiddenHistoryIds(state.hiddenHistoryRecordIds, recentHistoryEntries(state.calculations,state.expressionEditor?.records)),
          ...targets.map(historyEntryId),
        ], recentHistoryEntries(state.calculations,state.expressionEditor?.records)) };
      });
      return applied;
    },
    inputKey: key => {
      if (!/^[0-9.]$/.test(key)) return;
      set(state => {
        const replace = state.waitingForSecondOperand || state.display === 'Error';
        if (key === '.') {
          if (!replace && state.display.includes('.')) return {};
          return { display: replace ? '0.' : `${state.display}.`, waitingForSecondOperand: false };
        }
        const display = replace || state.display === '0' ? key : state.display + key;
        if (!Number.isFinite(Number(display))) return { display: 'Error', firstOperand: null,
          operator: null, waitingForSecondOperand: false };
        return { display,
          waitingForSecondOperand: false };
      });
    },
    selectOperator: operator => {
      if (!['+', '-', '*', '/'].includes(operator)) return;
      set(state => {
        if (!Number.isFinite(Number(state.display))) return {};
        if (state.firstOperand !== null && state.operator && !state.waitingForSecondOperand) {
          const calculated = calculateRecord(state, 'chain');
          return { ...calculated, firstOperand: calculated.display === 'Error' ? null : Number(calculated.display),
            operator: calculated.display === 'Error' ? null : operator,
            waitingForSecondOperand: calculated.display !== 'Error' };
        }
        return { firstOperand: Number(state.display), operator, waitingForSecondOperand: true };
      });
    },
    calculate: () => set(state => {
      if (state.operator === null || state.firstOperand === null) return {};
      if (!Number.isFinite(state.firstOperand) || !Number.isFinite(Number(state.display))) {
        return { display: 'Error', firstOperand: null, operator: null, waitingForSecondOperand: false };
      }
      return { ...calculateRecord(state, 'equals'), firstOperand: null, operator: null,
        waitingForSecondOperand: true };
    }),
    clear: () => set(state => ({ display: '0', firstOperand: null, operator: null,
      waitingForSecondOperand: false, clearCount: state.clearCount + 1 })),
    toggleSign: () => set(state => state.display === 'Error' || Number(state.display) === 0
      ? {} : { display: formatNumber(-Number(state.display)) }),
    percent: () => set(state => {
      if (!Number.isFinite(Number(state.display))) return {};
      const relative = state.firstOperand !== null && (state.operator === '+' || state.operator === '-');
      const display = formatNumber(Number(state.display) / 100 * (relative ? state.firstOperand! : 1));
      if (display === 'Error') return { display, firstOperand: null, operator: null, waitingForSecondOperand: false };
      return { display,
        waitingForSecondOperand: false };
    }),
  }),
);
