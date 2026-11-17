import { describe, expect, it } from 'vitest';
import { hasFreshCalculationSteps, type CalculationStep } from '../foldagent_calculation_evidence';
import type { CalculationRecord } from '../system/Calculator/types';

const steps: CalculationStep[] = [
  { left: 12.3, operator: '*', right: 2, result: 24.6 },
  { left: 24.6, operator: '+', right: 8.75, result: 33.35 },
];
const records = (): CalculationRecord[] => steps.map((step, index) => ({ ...step, id: index + 1,
  displayResult: String(step.result), origin: index === 0 ? 'chain' : 'equals' }));
const state = (calculations: CalculationRecord[] = records(), count = calculations.length) => ({ calculationCount: count, calculations });
const empty = () => state([], 0);

describe('fresh calculation evidence', () => {
  it('accepts a newly recorded chained calculation', () => {
    expect(hasFreshCalculationSteps(empty(), state(), steps)).toBe(true);
  });
  it('rejects stale correct history and direct display-only answers', () => {
    expect(hasFreshCalculationSteps(state(), state(), steps)).toBe(false);
    expect(hasFreshCalculationSteps(empty(), { ...empty(), display: '33.35' }, steps)).toBe(false);
  });
  it('allows commuted multiplication and addition operands', () => {
    const list = records().map(record => ({ ...record, left: record.right, right: record.left }));
    expect(hasFreshCalculationSteps(empty(), state(list), steps)).toBe(true);
  });
  it('does not accept an unrelated formula with the same final number', () => {
    const list: CalculationRecord[] = [{ id: 1, left: 30, operator: '+', right: 3.35,
      result: 33.35, displayResult: '33.35', origin: 'equals' }];
    expect(hasFreshCalculationSteps(empty(), state(list), steps)).toBe(false);
  });
  it('requires the step order and fresh operands, not just a matching result', () => {
    const reversed = records().reverse().map((record, index) => ({ ...record, id: index + 1 }));
    expect(hasFreshCalculationSteps(empty(), state(reversed), steps)).toBe(false);
    expect(hasFreshCalculationSteps(state(records().slice(0, 1)), state(), steps)).toBe(false);
  });
  it('allows unrelated intermediate calculations without counting them as required steps', () => {
    const list = records();
    list.splice(1, 0, { id: 2, left: 1, operator: '+', right: 1, result: 2, displayResult: '2', origin: 'equals' });
    list[2].id = 3;
    expect(hasFreshCalculationSteps(empty(), state(list), steps)).toBe(true);
  });
  it.each(['counter', 'id', 'result', 'display', 'origin', 'numeric-string', 'missing', 'duplicate'])
    ('rejects inconsistent journal: %s', kind => {
      const current: any = state();
      if (kind === 'counter') current.calculationCount = 3;
      if (kind === 'id') current.calculations[0].id = 0;
      if (kind === 'result') current.calculations[0].result = 33.35;
      if (kind === 'display') current.calculations[0].displayResult = '24.60';
      if (kind === 'origin') current.calculations[0].origin = 'injected';
      if (kind === 'numeric-string') current.calculations[0].left = '12.3';
      if (kind === 'missing') current.calculations.shift();
      if (kind === 'duplicate') current.calculations[1].id = 1;
      expect(hasFreshCalculationSteps(empty(), current, steps)).toBe(false);
    });
  it('rejects changed surviving history and counter resets', () => {
    const before = state();
    const list = [...records(), ...records().map(record => ({ ...record, id: record.id + 2 }))];
    list[0] = { id: 1, left: 1, operator: '+', right: 1, result: 2, displayResult: '2', origin: 'equals' };
    expect(hasFreshCalculationSteps(before, state(list), steps)).toBe(false);
    expect(hasFreshCalculationSteps(before, empty(), steps)).toBe(false);
  });
  it('accepts natural journal eviction but fails when a required step has been evicted', () => {
    const base: CalculationRecord = { id: 1, left: 1, operator: '+', right: 1, result: 2, displayResult: '2', origin: 'equals' };
    const before = state(Array.from({ length: 32 }, (_, index) => ({ ...base, id: index + 1 })));
    const fresh = records().map(record => ({ ...record, id: record.id + 32 }));
    const after = state([...before.calculations.slice(2), ...fresh], 34);
    expect(hasFreshCalculationSteps(before, after, steps)).toBe(true);
    const evicted = state(Array.from({ length: 32 }, (_, index) => ({ ...base, id: index + 35 })), 66);
    expect(hasFreshCalculationSteps(before, evicted, steps)).toBe(false);
  });
  it('rejects empty or mathematically invalid expected steps', () => {
    expect(hasFreshCalculationSteps(empty(), state(), [])).toBe(false);
    expect(hasFreshCalculationSteps(empty(), state(), [{ ...steps[0], result: 99 }])).toBe(false);
  });
  it('does not commute subtraction', () => {
    const actual: CalculationRecord = { id: 1, left: 7, operator: '-', right: 2, result: 5, displayResult: '5', origin: 'equals' };
    expect(hasFreshCalculationSteps(empty(), state([actual]), [{ left: 2, operator: '-', right: 7, result: -5 }])).toBe(false);
  });
  it('allows real error records as intermediate work but never as expected results', () => {
    const error: CalculationRecord = { id: 1, left: 1, operator: '/', right: 0,
      result: null, displayResult: 'Error', origin: 'equals' };
    const list = [error, ...records().map(record => ({ ...record, id: record.id + 1 }))];
    expect(hasFreshCalculationSteps(empty(), state(list), steps)).toBe(true);
  });
  it('rejects object-valued operators and origins rather than coercing them', () => {
    const current: any = state();
    current.calculations[0].origin = { toString: () => 'chain' };
    expect(hasFreshCalculationSteps(empty(), current, steps)).toBe(false);
    current.calculations[0].origin = 'chain';
    current.calculations[0].operator = { toString: () => '*' };
    expect(hasFreshCalculationSteps(empty(), current, steps)).toBe(false);
  });
});
