import { describe, expect, it } from 'vitest';
import { hasFreshPriceTotal, type PriceQuantityFact } from '../foldagent_price_total_evidence';
import type { CalculationRecord, CalculatorOperator } from '../system/Calculator/types';

const facts: PriceQuantityFact[] = [{ dishId: 'a', unitPriceCents: 1230, quantity: 2 },
  { dishId: 'b', unitPriceCents: 875, quantity: 1 }];
const empty = { calculationCount: 0, calculations: [] };
function state(operations: [number, CalculatorOperator, number][]) {
  const calculations: CalculationRecord[] = operations.map(([left, operator, right], index) => {
    const value = operator === '+' ? left + right : operator === '-' ? left - right
      : operator === '*' ? left * right : left / right;
    const result = Number.isFinite(value) ? Number(value.toPrecision(10)) : null;
    return { id: index + 1, left, operator, right, result, displayResult: result === null ? 'Error' : String(result), origin: 'equals' };
  });
  return { calculationCount: calculations.length, calculations };
}
describe('source-bound fresh linear price totals', () => {
  it.each([
    [[[12.3, '*', 2], [8.75, '*', 1], [24.6, '+', 8.75]]],
    [[[12.3, '+', 12.3], [24.6, '+', 8.75]]],
    [[[8.75, '+', 12.3], [21.05, '+', 12.3]]],
    [[[12.3, '+', 8.75], [21.05, '*', 2], [42.1, '-', 8.75]]],
    [[[12.3, '*', 3], [36.9, '-', 12.3], [24.6, '+', 8.75]]],
    [[[12.3, '*', 4], [49.2, '/', 2], [24.6, '+', 8.75]]],
  ] as [ [number, CalculatorOperator, number][] ][])('accepts an alternative linear path %j', operations => {
    expect(hasFreshPriceTotal(empty, state(operations), facts)).toBe(true);
  });
  it('rejects the same final number from unrelated operands', () => {
    expect(hasFreshPriceTotal(empty, state([[30, '+', 3.35]]), facts)).toBe(false);
  });
  it('rejects wrong quantities compensated by an unrelated constant', () => {
    expect(hasFreshPriceTotal(empty, state([[12.3, '*', 1], [12.3, '+', 21.05]]), facts)).toBe(false);
  });
  it('does not import old correct computations as fresh intermediate evidence', () => {
    const before = state([[12.3, '*', 2], [8.75, '*', 1], [24.6, '+', 8.75]]);
    expect(hasFreshPriceTotal(before, before, facts)).toBe(false);
    const after = state([[12.3, '*', 2], [8.75, '*', 1], [24.6, '+', 8.75], [33.35, '+', 0]]);
    expect(hasFreshPriceTotal(before, after, facts)).toBe(false);
  });
  it('rejects a typed answer and malformed journal', () => {
    expect(hasFreshPriceTotal(empty, { ...empty, display: '33.35' }, facts)).toBe(false);
    const malformed = state([[12.3, '+', 12.3], [24.6, '+', 8.75]]);
    malformed.calculations[0].result = 99;
    expect(hasFreshPriceTotal(empty, malformed, facts)).toBe(false);
  });
  it('groups equal unit prices instead of prescribing per-dish multiplication', () => {
    expect(hasFreshPriceTotal(empty, state([[12.3, '*', 3]]), [facts[0], { ...facts[1], unitPriceCents: 1230 }])).toBe(true);
  });
  it('allows omitted zero-price terms but still requires a fresh calculation', () => {
    expect(hasFreshPriceTotal(empty, state([[12.3, '*', 2]]), [facts[0], { ...facts[1], unitPriceCents: 0 }])).toBe(true);
    expect(hasFreshPriceTotal(empty, state([[0, '+', 0]]), [{ ...facts[0], unitPriceCents: 0 }])).toBe(true);
    expect(hasFreshPriceTotal(empty, state([[1, '-', 1]]), [{ ...facts[0], unitPriceCents: 0 }])).toBe(false);
  });
  it('allows real error records and irrelevant calculations as intermediate work', () => {
    expect(hasFreshPriceTotal(empty, state([[1, '/', 0], [1, '+', 1], [12.3, '+', 12.3], [24.6, '+', 8.75]]), facts)).toBe(true);
  });
  it.each(['duplicate', 'fractional', 'negative', 'unsafe', 'blank'])('rejects invalid source facts as environment errors: %s', kind => {
    const invalid = structuredClone(facts);
    if (kind === 'duplicate') invalid[1].dishId = 'a';
    if (kind === 'fractional') invalid[0].quantity = 1.5;
    if (kind === 'negative') invalid[0].unitPriceCents = -1;
    if (kind === 'unsafe') invalid[0].unitPriceCents = 2**53;
    if (kind === 'blank') invalid[0].dishId = '';
    expect(() => hasFreshPriceTotal(empty, empty, invalid)).toThrow();
  });
  it('throws on excessive ambiguity rather than dropping paths and reporting failure', () => {
    const ambiguous = Array.from({ length: 8 }, (_, i) => ({ dishId: `p${i}`, unitPriceCents: 2**i, quantity: 10 }));
    const operations: [number, CalculatorOperator, number][] = Array.from({ length: 7 }, (_, i) => [2**i / 100, '+', 2**i / 100]);
    expect(() => hasFreshPriceTotal(empty, state(operations), ambiguous)).toThrow(RangeError);
  });
});
