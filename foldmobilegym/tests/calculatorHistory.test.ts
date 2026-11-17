import { beforeEach, describe, expect, it } from 'vitest';
import { getCalculationHistoryRows, historyDateKey, historyDateLabel } from '../system/Calculator/historyPresentation';
import { useCalculatorStore } from '../system/Calculator/state';
import { CALCULATOR_CONFIG } from '../system/Calculator/data';
import type { CalculationRecord } from '../system/Calculator/types';
const record = (id: number, patch: Partial<CalculationRecord> = {}): CalculationRecord => ({
  id, left: 3, right: 4, operator: '+', result: 7, displayResult: '7', origin: 'equals', ...patch,
});
describe('Calculator read-only history presentation', () => {
  it('shows month and day for this year while distinguishing older years', () => {
    const now = new Date(2026, 9, 17), current = new Date(2026, 6, 19), old = new Date(2025, 6, 19);
    expect(historyDateLabel(current, now, 'zh-CN', 'undated')).toBe('7月19日');
    expect(historyDateLabel(old, now, 'zh-CN', 'undated')).toContain('2025');
    expect(historyDateLabel(current, now, 'en-US', 'undated')).toBe('July 19');
    expect(historyDateKey(current)).not.toBe(historyDateKey(old));
    expect(historyDateKey(new Date(NaN))).toBe('undated');
    expect(historyDateLabel(new Date(NaN), now, 'en-US', 'undated')).toBe('undated');
  });
  it('does not invent an empty history entry', () => {
    expect(getCalculationHistoryRows([])).toEqual([]);
  });
  it('orders newest first without sorting or mutating frozen source records', () => {
    const source = Object.freeze([Object.freeze(record(1)), Object.freeze(record(2, { origin: 'chain' }))]);
    expect(getCalculationHistoryRows(source).map(row => row.id)).toEqual([2, 1]);
    expect(source.map(row => row.id)).toEqual([1, 2]);
  });
  it('shows at most the latest 32 while retaining the complete supplied journal', () => {
    const source = Array.from({ length: 40 }, (_, index) => record(index + 1));
    const original = structuredClone(source), rows = getCalculationHistoryRows(source);
    expect(rows).toHaveLength(32); expect(rows[0].id).toBe(40); expect(rows[31].id).toBe(9);
    expect(source).toEqual(original);
  });
  it('presents actual binary operators with unambiguous negative operands', () => {
    expect(getCalculationHistoryRows([
      record(1, { left: -2, right: -3, operator: '*' }),
      record(2, { left: 8, right: 2, operator: '/' }),
      record(3, { left: 5, right: -1, operator: '-' }),
    ]).map(row => row.expression)).toEqual(['5 − (-1)', '8 ÷ 2', '(-2) × (-3)']);
  });
  it('preserves recorded rounding and error results rather than recalculating', () => {
    expect(getCalculationHistoryRows([
      record(1, { left: 1, right: 3, operator: '/', result: 1 / 3, displayResult: '0.3333333333' }),
      record(2, { left: 3, right: 0, operator: '/', result: null, displayResult: 'Error' }),
    ]).map(row => row.result)).toEqual(['Error', '0.3333333333']);
  });
});
describe('History does not write Calculator business/evaluation state', () => {
  beforeEach(() => useCalculatorStore.setState(structuredClone(CALCULATOR_CONFIG)));
  it('does not create calculation evidence from a partially entered expression', () => {
    const store = useCalculatorStore.getState();
    store.inputKey('9'); store.selectOperator('+'); store.inputKey('2');
    const before = JSON.stringify(useCalculatorStore.getState());
    expect(getCalculationHistoryRows(useCalculatorStore.getState().calculations)).toEqual([]);
    expect(JSON.stringify(useCalculatorStore.getState())).toBe(before);
  });
  it('leaves chain/equals records, counters and a new pending expression unchanged', () => {
    const store = useCalculatorStore.getState();
    store.inputKey('3'); store.selectOperator('*'); store.inputKey('4');
    store.selectOperator('+'); store.inputKey('1'); store.calculate();
    store.clear(); store.inputKey('9'); store.selectOperator('-'); store.inputKey('2');
    const before = JSON.stringify(useCalculatorStore.getState());
    expect(getCalculationHistoryRows(useCalculatorStore.getState().calculations).map(row => row.result)).toEqual(['13', '12']);
    expect(JSON.stringify(useCalculatorStore.getState())).toBe(before);
    store.calculate(); expect(useCalculatorStore.getState().display).toBe('7');
  });
});
