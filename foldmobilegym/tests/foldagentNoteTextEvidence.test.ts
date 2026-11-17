import { describe, expect, it } from 'vitest';
import { getNoteTextEvidence as check } from '../foldagent_note_text_evidence';

const facts = [{ dishId: 'a', name: '鸡排饭', unitPriceCents: 1235, quantity: 2 },
  { dishId: 'b', name: '酸奶杯', unitPriceCents: 875, quantity: 1 }];
describe('Explicit note arithmetic text, not a complete natural-language judge', () => {
  it.each([
    '鸡排饭 × 2，单价 ¥12.35\n酸奶杯 × 1，单价 ¥8.75\n12.35 × 2 + 8.75 = ¥33.45',
    '8.75 + 2*12.35 = CNY 33.45',
    'Expression: 12.35+12.35+8.75\nTotal: RMB 33.45',
    '算式：（12.35+8.75）×2-8.75\n合计：33.45元',
    '- 酸奶杯 × 1, Unit price: CNY 8.75\n- 鸡排饭 × 2, 单价: ￥12.35\n算式：8.75+12.35×2＝33.45元',
    '公开费用记录\n```math\n12.35*2+8.75 = 33.45\n```\nTotal: 33.45',
    '$$12.35*2+8.75=33.45$$',
    '鸡排饭 × 2\n酸奶杯 × 1\n12.35*2+8.75=33.45',
  ])('accepts recognized layouts and source-consistent expressions: %s', content => {
    expect(check(content, facts).status).toBe('proven');
  });
  it('rejects contradictory named quantity and price claims despite correct arithmetic', () => {
    expect(check('鸡排饭 × 3，单价 ¥12.35\n12.35*2+8.75=33.45', facts).reason).toBe('wrong_source_quantity');
    expect(check('鸡排饭 × 2，单价 ¥12.36\n12.35*2+8.75=33.45', facts).reason).toBe('wrong_source_unit_price');
  });
  it('checks all explicitly stated totals and rejects wrong expression values', () => {
    expect(check('12.35*2+8.75=33.45\n合计：33.44', facts).reason).toBe('wrong_stated_total');
    expect(check('12.35*3+8.75=33.45', facts).reason).toBe('wrong_expression_total');
    expect(check('算式：12.35*2+8.75\n总价：33.45\n结果：33.44', facts).status).toBe('contradicted');
  });
  it.each(['总价：33.45', '12.35*2+8.75', 'Expression: (12.35*2+8.75)^1\nTotal: 33.45',
    '鸡排饭 两份\n12.35*2+8.75=33.45', '鸡排饭和酸奶杯的总额\n12.35*2+8.75=33.45',
    '12.35*2+8.75=33.45=33.45',
    '12.35*2+8.75=33.45\n算式：12.35+12.35+8.75', '30+3.45=33.45'])
    ('defers unsupported/ambiguous cases rather than counting an agent failure: %s', content => {
      expect(check(content, facts).status).toBe('unproven');
    });
  it('does not strip unary minus as a bullet', () => {
    expect(check('- 12.35*2+8.75=33.45', facts).reason).toBe('wrong_expression_total');
  });
  it('escapes punctuation in dish names and defers duplicate display-name ambiguity', () => {
    const named = [{ dishId: 'a', name: '菜品(小)+', unitPriceCents: 1235, quantity: 2 }];
    expect(check('菜品(小)+ × 2, 单价 12.35\n12.35*2=24.70', named).status).toBe('proven');
    expect(check('鸡排饭 × 2\n12.35*2+8.75=33.45', [...facts, { ...facts[0], dishId: 'c' }]).status).toBe('unproven');
  });
  it('throws on invalid source facts or capacity excess instead of returning a negative', () => {
    expect(() => check('', [])).toThrow();
    expect(() => check('', [{ ...facts[0], name: '' }])).toThrow();
    expect(() => check('a'.repeat(8193), facts)).toThrow(RangeError);
    expect(() => check('\n'.repeat(129), facts)).toThrow(RangeError);
  });
  it('does not silently ignore unsupported total claims or case-variant named contradictions', () => {
    expect(check('12.35*2+8.75=33.45\n合计是99', facts).status).toBe('unproven');
    expect(check('12.35*2+8.75=33.45\nTotal approximately 99', facts).status).toBe('unproven');
    expect(check('MILK × 3\n12.35*2=24.70', [{ dishId: 'a', name: 'Milk', unitPriceCents: 1235, quantity: 2 }]).reason)
      .toBe('wrong_source_quantity');
  });
  it('resolves complete names even when another source name is a substring', () => {
    const overlapping = [{ dishId: 'a', name: '奶茶', unitPriceCents: 1235, quantity: 2 },
      { dishId: 'b', name: '椰奶奶茶', unitPriceCents: 875, quantity: 1 }];
    expect(check('椰奶奶茶 × 1，单价 8.75\n奶茶 × 2，单价 12.35\n12.35*2+8.75=33.45', overlapping).status)
      .toBe('proven');
    expect(check('椰奶奶茶 × 2\n12.35*2+8.75=33.45', overlapping).reason).toBe('wrong_source_quantity');
  });
  it('does not mistake numbers in an equation for a numeric dish name', () => {
    expect(check('12.35*2+8.75=33.45', facts.map(fact => ({ ...fact, name: '12' }))).status).toBe('proven');
  });
  it('accepts verified intermediate equations and still checks all explicit totals', () => {
    expect(check('12.35*2=24.70\n24.70+8.75=33.45\n合计：33.45', facts).status).toBe('proven');
    expect(check('12.35*2=24.70\n24.70+8.75=33.45\n合计：33.44', facts).reason).toBe('wrong_stated_total');
    expect(check('12.35*2=24.71\n24.71+8.75-0.01=33.45', facts).reason).toBe('wrong_intermediate_total');
    expect(check('20+4.70=24.70\n24.70+8.75=33.45', facts).status).toBe('unproven');
  });
});
