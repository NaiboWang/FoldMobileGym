import { beforeEach, describe, expect, it } from 'vitest';
import { useCalculatorStore } from '../system/Calculator/state';
import { CALCULATOR_CONFIG } from '../system/Calculator/data';

const store = () => useCalculatorStore.getState();
const input = (value: string) => [...value].forEach(key => store().inputKey(key));
beforeEach(() => useCalculatorStore.setState(structuredClone(CALCULATOR_CONFIG)));

describe('Calculator state and calculation evidence', () => {
  it('records decimal operands and the displayed rounded result', () => {
    input('0.1'); store().selectOperator('+'); input('0.2'); store().calculate();
    expect(store().display).toBe('0.3');
    expect(store().calculations).toEqual([{ id: 1, left: 0.1, right: 0.2,
      operator: '+', result: 0.3, displayResult: '0.3', origin: 'equals' }]);
  });
  it('does not manufacture evidence from opening or equals without an operator', () => {
    input('12'); store().calculate();
    expect(store().calculationCount).toBe(0);
    expect(store().calculations).toEqual([]);
  });
  it('replaces a pending operator without calculating a fictitious second operand', () => {
    input('8'); store().selectOperator('+'); store().selectOperator('*'); input('3'); store().calculate();
    expect(store().display).toBe('24');
    expect(store().calculationCount).toBe(1);
  });
  it('starts fresh on digits after equals, while an operator can reuse the result', () => {
    input('2'); store().selectOperator('+'); input('3'); store().calculate();
    input('4'); expect(store().display).toBe('4');
    store().selectOperator('*'); input('2'); store().calculate();
    store().selectOperator('+'); input('1'); store().calculate();
    expect(store().display).toBe('9');
    expect(store().calculationCount).toBe(3);
  });
  it('records both stages of left-to-right chained calculations', () => {
    input('12.3'); store().selectOperator('*'); input('2'); store().selectOperator('+'); input('1'); store().calculate();
    expect(store().display).toBe('25.6');
    expect(store().calculations.map(r => [r.left, r.operator, r.right, r.result, r.origin]))
      .toEqual([[12.3, '*', 2, 24.6, 'chain'], [24.6, '+', 1, 25.6, 'equals']]);
  });
  it('uses relative percentages for addition/subtraction and fractions for multiplication/division', () => {
    for (const [operator, expected] of [['+', '220'], ['-', '180'], ['*', '20'], ['/', '2000']] as const) {
      store().clear(); input('200'); store().selectOperator(operator); input('10'); store().percent(); store().calculate();
      expect(store().display).toBe(expected);
    }
  });
  it('represents divide by zero without non-JSON numbers and recovers on the next input', () => {
    input('3'); store().selectOperator('/'); input('0'); store().calculate();
    expect(store().display).toBe('Error');
    expect(store().calculations[0].result).toBeNull();
    store().selectOperator('+'); input('.'); input('5');
    expect(store().display).toBe('0.5');
    expect(store().operator).toBeNull();
  });
  it('ignores duplicate decimal points and invalid keys', () => {
    input('1..2'); store().inputKey('abc');
    expect(store().display).toBe('1.2');
  });
  it('rejects numeric overflow without persisting non-JSON operands', () => {
    input('2'); store().selectOperator('+'); input('9'.repeat(309)); store().calculate();
    expect(store().display).toBe('Error');
    expect(store().firstOperand).toBeNull();
    expect(store().operator).toBeNull();
    expect(store().calculations).toEqual([]);
  });
  it('clears the input without erasing previous calculation evidence', () => {
    input('9'); store().selectOperator('-'); input('2'); store().calculate(); store().clear();
    expect(store().display).toBe('0');
    expect(store().calculationCount).toBe(1);
    expect(store().clearCount).toBe(1);
    expect(store().calculations[0].result).toBe(7);
  });
  it('continues correctly from a serialized partial calculation', () => {
    input('24.8'); store().selectOperator('*'); input('2');
    const saved = JSON.parse(JSON.stringify(store()));
    store().clear(); useCalculatorStore.setState(saved); store().calculate();
    expect(store().display).toBe('49.6');
  });
  it('bounds the evidence journal while retaining a monotonic calculation count', () => {
    for (let i = 0; i < 40; i++) {
      store().clear(); input('1'); store().selectOperator('+'); input('2'); store().calculate();
    }
    expect(store().calculationCount).toBe(40);
    expect(store().calculations).toHaveLength(32);
    expect(store().calculations[0].id).toBe(9);
  });
});
