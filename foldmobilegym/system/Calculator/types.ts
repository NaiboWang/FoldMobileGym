import type { AngleUnit, MathErrorCode, MathOperation } from './expressionEngine';
export type CalculatorOperator = '+' | '-' | '*' | '/';
export interface CalculationRecord {
  id: number;
  left: number;
  right: number;
  operator: CalculatorOperator;
  result: number | null;
  displayResult: string;
  origin: 'equals' | 'chain';
  sequence?: number;
  expressionId?: number;
}
export interface CalculatorState {
  display: string;
  firstOperand: number | null;
  operator: CalculatorOperator | null;
  waitingForSecondOperand: boolean;
  calculationCount: number;
  clearCount: number;
  calculations: CalculationRecord[];
  /** User-visible removals; the bounded scientific evidence journal remains intact. */
  hiddenHistoryRecordIds?: HistoryId[];
  expressionEditor?: ExpressionEditorState;
}

export type HistoryId = number | `e${number}`;
export interface ExpressionCalculationRecord {
  id: number;
  origin: 'expression';
  expression: string;
  angleUnit: AngleUnit;
  result: number | null;
  displayResult: string;
  sequence: number;
  timestamp: number;
  operations: MathOperation[];
}
export type HistoryEntry = CalculationRecord | ExpressionCalculationRecord;
export type HistoryTarget = CalculationRecord | Omit<ExpressionCalculationRecord, 'operations'>;
export interface ExpressionEditorState {
  expression: string;
  showScientific: boolean;
  angleUnit: AngleUnit;
  inverse: boolean;
  memory: number | null;
  lastResult: string | null;
  error: MathErrorCode | null;
  justEvaluated: boolean;
  count: number;
  sequence: number;
  records: ExpressionCalculationRecord[];
}
