import { describe, expect, it } from 'vitest';
import { judgePriceNote as judge } from '../foldagent_price_note_judge';
const contract = { shopId: 'shop', quantities: { a: 2, b: 1 } };
function initial() {
  return { meituan_waimai: { shops: { shop: { id: 'shop', dishes: [
    { id: 'a', name: 'Dish A', price: 12.3 }, { id: 'b', name: 'Dish B', price: 8.75 },
  ] } }, cart: { shopId: 'shop', quantities: { a: 1 } }, orders: { old: { total: 12.3 } },
  user: { orderIds: ['old'] }, nextOrderNumber: 2 },
  calculator: { calculationCount: 0, calculations: [] as any[] },
  notes: { createdCount: 0, notes: [{ id: 'old', content: 'Do not change', title: 'Old' }] as any[] } };
}
function final(content = '12.30*2=24.60\n24.60+8.75=33.35') {
  const state = initial();
  state.calculator = { calculationCount: 2, calculations: [
    { id: 1, left: 12.3, operator: '*', right: 2, result: 24.6, displayResult: '24.6', origin: 'equals' },
    { id: 2, left: 24.6, operator: '+', right: 8.75, result: 33.35, displayResult: '33.35', origin: 'equals' },
  ] };
  state.notes.createdCount = 1;
  state.notes.notes.push({ id: 'new', title: 'Any title', content });
  return state;
}
describe('Composed private price-note business judgment', () => {
  it('proves initial-source arithmetic plus actual fresh calculation and one persisted note without mutation', () => {
    const before = initial(), after = final();
    const copy = JSON.stringify({ before, after, contract });
    expect(judge(before, after, contract)).toMatchObject({ status: 'proven', passed: true, reasons: [] });
    expect(JSON.stringify({ before, after, contract })).toBe(copy);
  });
  it('uses initial source facts and detects source changes even when current note fits changed prices', () => {
    const after = final('13*2+8.75=34.75');
    after.meituan_waimai.shops.shop.dishes[0].price = 13;
    expect(judge(initial(), after, contract).reasons).toContain('source_world_changed');
  });
  it.each(['shops', 'cart', 'orders', 'user', 'nextOrderNumber'])('protects source field %s', field => {
    const after: any = final(); after.meituan_waimai[field] = { changed: true };
    expect(judge(initial(), after, contract)).toMatchObject({ status: 'contradicted', passed: false });
  });
  it.each(['edit', 'delete'])('protects existing note against %s', mode => {
    const after = final();
    if (mode === 'edit') after.notes.notes[0].content = 'Changed'; else after.notes.notes.shift();
    expect(judge(initial(), after, contract).reasons).toContain('old_notes_changed');
  });
  it.each(['duplicate', 'counter', 'private', 'trash', 'epoch-trash', 'missing'])('rejects invalid business delta %s', mode => {
    const after = final();
    if (mode === 'duplicate') after.notes.notes.push({ ...after.notes.notes[1], id: 'extra' });
    if (mode === 'counter') after.notes.createdCount = 2;
    if (mode === 'private') after.notes.notes[1].isPrivate = true;
    if (mode === 'trash') after.notes.notes[1].trashedAt = 42;
    if (mode === 'epoch-trash') after.notes.notes[1].trashedAt = 0;
    if (mode === 'missing') after.notes.notes.pop();
    expect(judge(initial(), after, contract).reasons).toContain('new_note_delta_or_visibility');
  });
  it('requires fresh actual calculation, not a correct note or stale history', () => {
    const after = final(); after.calculator = initial().calculator;
    expect(judge(initial(), after, contract).reasons).toContain('no_fresh_calculation');
    const before = initial(); before.calculator = final().calculator;
    expect(judge(before, final(), contract).reasons).toContain('no_fresh_calculation');
  });
  it('defers a fresh valid same-total calculation with an unproven source relation', () => {
    const after = final(); after.calculator = { calculationCount: 1, calculations: [
      { id: 1, left: 30, operator: '+', right: 3.35, result: 33.35, displayResult: '33.35', origin: 'equals' },
    ] };
    expect(judge(initial(), after, contract)).toMatchObject({ status: 'unproven', passed: null,
      reasons: ['calculation_source_relation_not_proven'] });
  });
  it('defers unsupported note syntax but rejects a definite arithmetic contradiction', () => {
    expect(judge(initial(), final('(12.30*2+8.75)^1=33.35'), contract).passed).toBeNull();
    expect(judge(initial(), final('12.30*2=24.61\n24.61+8.75-0.01=33.35'), contract))
      .toMatchObject({ status: 'contradicted', reasons: ['note:wrong_intermediate_total'] });
  });
  it('does not let unsupported notes hide explicit safety violations', () => {
    const after = final('unknown expression=33.35'); after.notes.notes[0].content = 'Changed';
    expect(judge(initial(), after, contract)).toMatchObject({ status: 'contradicted', passed: false });
  });
  it('ignores object key order and collection presentation order, not item data', () => {
    const after = final(); after.notes.notes.reverse();
    after.meituan_waimai.cart = { quantities: { a: 1 }, shopId: 'shop' };
    expect(judge(initial(), after, contract).passed).toBe(true);
  });
  it.each(['missing-app', 'missing-field', 'duplicate-note-id', 'counter-regression', 'journal', 'subcent', 'quantity', 'shop'])
    ('throws an environment error rather than a business rejection for %s', mode => {
      const before: any = initial(), after: any = final(), data: any = structuredClone(contract);
      if (mode === 'missing-app') delete before.notes;
      if (mode === 'missing-field') delete after.meituan_waimai.orders;
      if (mode === 'duplicate-note-id') after.notes.notes[1].id = 'old';
      if (mode === 'counter-regression') before.notes.createdCount = 2;
      if (mode === 'journal') after.calculator.calculations[0].displayResult = 'Wrong';
      if (mode === 'subcent') before.meituan_waimai.shops.shop.dishes[0].price = 12.301;
      if (mode === 'quantity') data.quantities.a = -1;
      if (mode === 'shop') data.shopId = 'missing';
      expect(() => judge(before, after, data)).toThrow();
    });
});
