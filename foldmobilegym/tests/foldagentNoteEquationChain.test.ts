import { describe, expect, it } from 'vitest';
import { getNoteEquationChainEvidence as check } from '../foldagent_note_expression_evidence';
const facts = [{ dishId: 'a', unitPriceCents: 1235, quantity: 2 }, { dishId: 'b', unitPriceCents: 875, quantity: 1 }];
const equations = (...lines: string[]) => lines.map(line => {
  const [expression, statedTotal] = line.split('='); return { expression, statedTotal };
});
describe('Exact ordered written equations with verified intermediate provenance', () => {
  it.each([
    ['12.35*2=24.70', '24.70+8.75=33.45'],
    ['12.35*2=24.70', '8.75*1=8.75', '24.70+8.75=33.45'],
    ['12.35/2=6.175', '6.175*4+8.75=33.45'],
    ['12.35*-2=-24.70', '-(-24.70)+8.75=33.45'],
    ['12.35*2+8.75=33.45', '12.35*2=24.70'],
  ])('proves source contributions across valid steps: %s', (...steps) => {
    expect(check(equations(...steps), facts).status).toBe('proven');
  });
  it('does not manufacture intermediates from a correct final number', () => {
    expect(check(equations('24.70+8.75=33.45'), facts).status).toBe('unproven');
    expect(check(equations('20+4.70=24.70', '24.70+8.75=33.45'), facts).status).toBe('unproven');
    expect(check(equations('33.45=33.45'), facts).status).toBe('unproven');
  });
  it('rejects a false intermediate even when compensation makes the final amount correct', () => {
    expect(check(equations('12.35*2=24.71', '24.71+8.75-0.01=33.45'), facts))
      .toEqual({ status: 'contradicted', reason: 'wrong_intermediate_total' });
  });
  it('does not ignore a bad or unsupported statement after an already proven total', () => {
    expect(check(equations('12.35*2+8.75=33.45', '1+1=3'), facts).status).toBe('contradicted');
    expect(check(equations('12.35*2+8.75=33.45', '2^1=2'), facts).status).toBe('unproven');
  });
  it('handles equal-valued intermediates with distinct linear contributions without picking one silently', () => {
    const same = [{ dishId: 'a', unitPriceCents: 1000, quantity: 2 }, { dishId: 'b', unitPriceCents: 2000, quantity: 1 }];
    expect(check(equations('10*2=20', '20*1=20', '20+20=40'), same).status).toBe('proven');
  });
  it('keeps aliases episode-local and reports the actual proof equation', () => {
    const first = check(equations('12.35*2=24.70', '24.70+8.75=33.45'), facts);
    expect(first.status === 'proven' && first.equationIndex).toBe(1);
    expect(check(equations('24.70+8.75=33.45'), facts).status).toBe('unproven');
    const ordered = check(equations('12.35*2+8.75=33.45', '12.35*2=24.70'), facts);
    expect(ordered.status === 'proven' && ordered.equationIndex).toBe(0);
  });
  it('throws environment errors for capacity excess or malformed inputs', () => {
    expect(() => check([], facts)).toThrow();
    expect(() => check(Array.from({ length: 33 }, () => ({ expression: '1', statedTotal: '1' })), facts)).toThrow(RangeError);
  });
});
