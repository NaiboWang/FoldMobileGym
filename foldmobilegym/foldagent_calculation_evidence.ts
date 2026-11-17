import type { CalculationRecord, CalculatorOperator } from './system/Calculator/types';

export interface CalculationStep {
  left: number;
  right: number;
  operator: CalculatorOperator;
  result: number;
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const counter = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const object = (value: unknown): value is Record<string, unknown> => Boolean(value)
  && typeof value === 'object' && !Array.isArray(value);

function computed(left: number, operator: unknown, right: number) {
  const value = operator === '+' ? left + right : operator === '-' ? left - right
    : operator === '*' ? left * right : operator === '/' && right !== 0 ? left / right : NaN;
  if (!Number.isFinite(value)) return null;
  const rounded = Number(value.toPrecision(10));
  return Number.isFinite(rounded) ? rounded : null;
}

function recordValid(value: unknown): value is CalculationRecord {
  if (!object(value) || !counter(value.id) || value.id === 0
    || !finite(value.left) || !finite(value.right)
    || typeof value.operator !== 'string' || !['+', '-', '*', '/'].includes(value.operator)
    || typeof value.origin !== 'string' || !['equals', 'chain'].includes(value.origin)) return false;
  const result = computed(value.left, value.operator, value.right);
  return value.result === result && value.displayResult === (result === null ? 'Error' : String(result));
}

export function getCalculationJournal(state: unknown): { count: number; records: CalculationRecord[] } | null {
  if (!object(state) || !counter(state.calculationCount) || !Array.isArray(state.calculations)
    || state.calculations.length !== Math.min(32, state.calculationCount)) return null;
  const records: CalculationRecord[] = [];
  for (let index = 0; index < state.calculations.length; index++) {
    const record: unknown = state.calculations[index];
    if (!recordValid(record) || record.id !== state.calculationCount - state.calculations.length + index + 1) return null;
    records.push(record);
  }
  return { count: state.calculationCount, records };
}

function sameRecord(a: CalculationRecord, b: CalculationRecord) {
  return a.id === b.id && a.left === b.left && a.right === b.right && a.operator === b.operator
    && a.result === b.result && a.displayResult === b.displayResult && a.origin === b.origin;
}

/** Shared private journal validation; return only new, internally valid records. */
export function getFreshCalculationRecords(initial: unknown, current: unknown): CalculationRecord[] | null {
  const before = getCalculationJournal(initial);
  const after = getCalculationJournal(current);
  if (!before || !after || after.count <= before.count) return null;
  // Surviving initial history is immutable; natural 32-entry eviction is allowed.
  for (const record of after.records.filter(record => record.id <= before.count)) {
    const old = before.records.find(item => item.id === record.id);
    if (!old || !sameRecord(old, record)) return null;
  }
  return after.records.filter(record => record.id > before.count);
}

/** Match an ordered new-record subsequence, permitting commuted +/* operands.
 * This is not proof of source lookup or screenshot-agent input. */
export function hasFreshCalculationSteps(initial: unknown, current: unknown, steps: readonly CalculationStep[]): boolean {
  const fresh = getFreshCalculationRecords(initial, current);
  if (!fresh || steps.length === 0 || steps.some(step => !finite(step.left) || !finite(step.right) || !finite(step.result)
    || computed(step.left, step.operator, step.right) !== step.result)) return false;
  let matched = 0;
  for (const record of fresh) {
    const step = steps[matched];
    const operands = record.left === step.left && record.right === step.right
      || (step.operator === '+' || step.operator === '*') && record.left === step.right && record.right === step.left;
    if (record.operator === step.operator && record.result === step.result && operands) matched += 1;
    if (matched === steps.length) return true;
  }
  return false;
}
