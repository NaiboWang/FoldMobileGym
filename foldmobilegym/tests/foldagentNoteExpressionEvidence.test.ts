import { describe, expect, it } from 'vitest';
import { getNoteExpressionEvidence as check } from '../foldagent_note_expression_evidence';

const facts = [{ dishId: 'a', unitPriceCents: 1235, quantity: 2 }, { dishId: 'b', unitPriceCents: 875, quantity: 1 }];
describe('Exact note expression sufficient evidence, separate from calculator use', () => {
  it.each([
    '12.35*2+8.75', '8.75 + 2 × 12.35', '12.35+12.35+8.75',
    '(12.35 + 8.75) * 2 - 8.75', '(12.35*4)/2+8.75',
    '(-12.35)*(-2)+8.75', '（１２.３５ × ２）＋８.７５', '¥12.35 x 2 + ￥8.75',
  ])('accepts the equivalent source expression %s', expression => {
    expect(check(expression, 'CNY 33.45', facts).status).toBe('proven');
  });
  it('keeps cent arithmetic exact rather than accepting a tolerance', () => {
    const cents = [{ dishId: 'a', unitPriceCents: 10, quantity: 1 }, { dishId: 'b', unitPriceCents: 20, quantity: 1 }];
    expect(check('.1+.2', '0.30元', cents).status).toBe('proven');
    expect(check('.1+.2', '0.3000000001', cents).reason).toBe('wrong_stated_total');
    expect(check('.1+.2000000001', '.3', cents).reason).toBe('wrong_expression_total');
  });
  it('distinguishes explicit numerical contradictions from unproven source relations', () => {
    expect(check('12.35+8.75', '33.45', facts)).toEqual({ status: 'contradicted', reason: 'wrong_expression_total' });
    expect(check('12.35*2+8.75', '33.44', facts).reason).toBe('wrong_stated_total');
    expect(check('30+3.45', '33.45', facts)).toEqual({ status: 'unproven', reason: 'source_relation_not_proven' });
    expect(check('33.45', '33.45', facts).status).toBe('unproven');
    expect(check('12.35*3+8.75-12.35', '33.45', facts).status).toBe('proven');
  });
  it('does not certify compensated wrong quantities using unrelated constants', () => {
    expect(check('12.35+8.75+12.35', '33.45', facts).status).toBe('proven');
    expect(check('12.35+8.75+10+2.35', '33.45', facts).status).toBe('unproven');
  });
  it('groups equal prices numerically without claiming dish identity proof', () => {
    const samePrice = [{ dishId: 'a', unitPriceCents: 1235, quantity: 2 }, { dishId: 'b', unitPriceCents: 1235, quantity: 1 }];
    expect(check('12.35*3', '37.05', samePrice).status).toBe('proven');
  });
  it('permits omitting zero-price terms and exact fractional scaling', () => {
    expect(check('12.35*2+8.75', '33.45', [...facts, { dishId: 'free', unitPriceCents: 0, quantity: 3 }]).status).toBe('proven');
    expect(check('0*3', '0', [{ dishId: 'free', unitPriceCents: 0, quantity: 3 }]).status).toBe('proven');
    expect(check('12.35/(1/2)+8.75', '33.45', facts).status).toBe('proven');
  });
  it('supports conventional currency/decimal formatting and thousands separators', () => {
    expect(check('1,000.00*2', 'RMB 2,000.00', [{ dishId: 'a', unitPriceCents: 100000, quantity: 2 }]).status).toBe('proven');
    expect(check('12.35*2+8.75', '￥33.45元', facts).status).toBe('proven');
    expect(check('12.35*2+8.75', '33,45', facts).status).toBe('unproven');
  });
  it.each(['12.35**2', 'sqrt(12.35)', '12.35*2+', '12.35(2)+8.75', 'globalThis.pwned=true', '12.35^2',
    '12.35/0^0+8.75', '12.35/0+'])
    ('leaves unsupported syntax unproven without evaluating code: %s', expression => {
      expect(check(expression, '33.45', facts).status).toBe('unproven');
    });
  it('marks a supported division by zero as contradictory', () => {
    expect(check('12.35/0+8.75', '33.45', facts)).toEqual({ status: 'contradicted', reason: 'division_by_zero' });
  });
  it('throws for bad source facts and oversized input rather than counting agent failure', () => {
    for (const invalid of [[], [...facts, facts[0]], [{ dishId: 'a', unitPriceCents: 1.5, quantity: 1 }],
      [{ dishId: 'a', unitPriceCents: 1235, quantity: 0 }],
      [{ dishId: 'a', unitPriceCents: Number.MAX_SAFE_INTEGER, quantity: 2 }]]) {
      expect(() => check('1', '1', invalid)).toThrow();
    }
    expect(() => check('1'.repeat(513), '33.45', facts)).toThrow(RangeError);
    expect(() => check('12.35*2+8.75', '1'.repeat(129), facts)).toThrow(RangeError);
    expect(() => check('+'.repeat(193) + '12.35', '33.45', facts)).toThrow(RangeError);
  });
  it('reports excessive source ambiguity as an environment capacity error', () => {
    const manyPrices = Array.from({ length: 9 }, (_, index) => ({
      dishId: `dish-${index}`, unitPriceCents: (index + 1) * 100, quantity: 1,
    }));
    expect(() => check('1+2+3+4+5+6+7+8+9', '45', manyPrices)).toThrow(RangeError);
  });
  it('preserves frozen source facts and verifies a deterministic range of cent/quantity combinations', () => {
    for (let index = 0; index < 25; index++) {
      const source = Object.freeze([
        Object.freeze({ dishId: 'a', unitPriceCents: 100 + index * 7, quantity: 2 + index % 3 }),
        Object.freeze({ dishId: 'b', unitPriceCents: 303 + index * 11, quantity: 1 + index % 2 }),
      ]);
      const totalCents = source.reduce((sum, fact) => sum + fact.unitPriceCents * fact.quantity, 0);
      const total = (totalCents / 100).toFixed(2);
      const a = (source[0].unitPriceCents / 100).toFixed(2);
      const b = (source[1].unitPriceCents / 100).toFixed(2);
      const expression = `((${a}*${source[0].quantity}*3)/3)+${b}*${source[1].quantity}`;
      expect(check(expression, total, source).status).toBe('proven');
      expect(check(expression, ((totalCents - 1) / 100).toFixed(2), source).reason).toBe('wrong_stated_total');
      expect(check(`${total}+${a}-${a}`, total, source).status).toBe('unproven');
    }
  });
});
