import { getFreshCalculationRecords } from './foldagent_calculation_evidence';

export interface PriceQuantityFact {
  dishId: string;
  unitPriceCents: number;
  quantity: number;
}

interface LinearAmount { constant: number; coefficients: number[]; usedSource: boolean }
const MAX_VARIANTS = 256;

/** Private sufficient evidence for linear price arithmetic, not a complete
 * algebra-equivalence judge or proof of screenshot-agent/source interaction.
 * Return false means unproven; nonlinear or ambiguous paths may also be unproven.
 * Invalid source facts / excessive ambiguity throw environment errors rather
 * than silently trimming alternatives and reporting an agent failure.
 */
export function hasFreshPriceTotal(initial: unknown, current: unknown, facts: readonly PriceQuantityFact[]): boolean {
  if (!facts.length || facts.some(fact => typeof fact.dishId !== 'string' || !fact.dishId
    || !Number.isSafeInteger(fact.unitPriceCents) || fact.unitPriceCents < 0
    || !Number.isSafeInteger(fact.quantity) || fact.quantity < 1)
    || new Set(facts.map(fact => fact.dishId)).size !== facts.length) throw Error('Invalid source price/quantity facts');
  const expectedCents = facts.reduce((sum, fact) => sum + fact.unitPriceCents * fact.quantity, 0);
  if (!Number.isSafeInteger(expectedCents)) throw Error('Source total is outside the safe cent range');
  const fresh = getFreshCalculationRecords(initial, current);
  if (!fresh) return false;
  // Equal unit prices are interchangeable numerically; Notes must separately
  // retain each dish identity/quantity. Zero-price contributions may be omitted.
  const prices = [...new Set(facts.map(fact => fact.unitPriceCents).filter(price => price !== 0))];
  const expected = prices.map(price => facts.filter(fact => fact.unitPriceCents === price)
    .reduce((sum, fact) => sum + fact.quantity, 0));
  if (expected.some(quantity => !Number.isSafeInteger(quantity))) throw Error('Grouped quantity outside safe range');
  const hasZeroPrice = facts.some(fact => fact.unitPriceCents === 0);
  const history = new Map<number, LinearAmount[]>();
  const unique = (amounts: LinearAmount[]) => {
    const variants = new Map<string, LinearAmount>();
    for (const amount of amounts) {
      if (![amount.constant, ...amount.coefficients].every(Number.isFinite)) continue;
      variants.set(JSON.stringify([amount.constant, amount.coefficients, amount.usedSource]), amount);
      if (variants.size > MAX_VARIANTS) throw new RangeError('Price-evidence ambiguity exceeds diagnostic capacity');
    }
    return [...variants.values()];
  };
  const operands = (value: number): LinearAmount[] => {
    const literal = { constant: value, coefficients: prices.map(() => 0), usedSource: false };
    const variants = [literal, ...(history.get(value) || [])];
    const index = prices.findIndex(price => price / 100 === value);
    if (index >= 0) variants.push({ constant: 0, coefficients: prices.map((_, i) => Number(i === index)), usedSource: true });
    if (value === 0 && hasZeroPrice) variants.push({ ...literal, usedSource: true });
    return unique(variants);
  };
  const scalar = (amount: LinearAmount) => amount.coefficients.every(coefficient => coefficient === 0);
  const scale = (amount: LinearAmount, factor: number, usedSource: boolean): LinearAmount => ({
    constant: amount.constant * factor, coefficients: amount.coefficients.map(coefficient => coefficient * factor), usedSource,
  });
  for (const record of fresh) {
    if (record.result === null) continue;
    const candidates: LinearAmount[] = [];
    for (const left of operands(record.left)) for (const right of operands(record.right)) {
      const usedSource = left.usedSource || right.usedSource;
      if (record.operator === '+' || record.operator === '-') {
        const sign = record.operator === '+' ? 1 : -1;
        candidates.push({ constant: left.constant + sign * right.constant,
          coefficients: left.coefficients.map((coefficient, i) => coefficient + sign * right.coefficients[i]), usedSource });
      } else if (record.operator === '*') {
        if (scalar(left)) candidates.push(scale(right, left.constant, usedSource));
        if (scalar(right)) candidates.push(scale(left, right.constant, usedSource));
      } else if (record.operator === '/' && scalar(right) && right.constant !== 0) {
        candidates.push(scale(left, 1 / right.constant, usedSource));
      }
    }
    const amounts = unique(candidates);
    if (record.result === expectedCents / 100 && amounts.some(amount => amount.usedSource && amount.constant === 0
      && amount.coefficients.every((coefficient, index) => coefficient === expected[index]))) return true;
    history.set(record.result, unique([...(history.get(record.result) || []), ...amounts]));
  }
  return false;
}
