import type { PriceQuantityFact } from './foldagent_price_total_evidence';

export type NoteExpressionEvidence =
  | { status: 'proven'; reason: 'source_linear_expression'; equationIndex?: number }
  | { status: 'contradicted'; reason: 'wrong_stated_total' | 'wrong_expression_total' | 'wrong_intermediate_total' | 'division_by_zero' }
  | { status: 'unproven'; reason: 'unsupported_syntax' | 'source_relation_not_proven' };

interface Rational { n: bigint; d: bigint }
interface Amount { constant: Rational; coefficients: Rational[]; usedSource: boolean }
interface Value { value: Rational; variants: Amount[] }
type Expression = { kind: 'literal'; value: Rational }
  | { kind: 'negate'; item: Expression }
  | { kind: 'binary'; operator: string; left: Expression; right: Expression };
const ZERO = { n: 0n, d: 1n };
const ONE = { n: 1n, d: 1n };
const MAX_VARIANTS = 256;
class UnsupportedSyntax extends Error {}
class DivisionByZero extends Error {}
const equal = (a: Rational, b: Rational) => a.n === b.n && a.d === b.d;
const zero = (a: Rational) => a.n === 0n;
function rational(n: bigint, d = 1n): Rational {
  if (d === 0n) throw new DivisionByZero();
  if (d < 0n) { n = -n; d = -d; }
  let a = n < 0n ? -n : n;
  let b = d;
  while (b !== 0n) { const remainder = a % b; a = b; b = remainder; }
  return { n: n / a, d: d / a };
}
const add = (a: Rational, b: Rational) => rational(a.n * b.d + b.n * a.d, a.d * b.d);
const multiply = (a: Rational, b: Rational) => rational(a.n * b.n, a.d * b.d);
const negate = (a: Rational) => ({ n: -a.n, d: a.d });
const divide = (a: Rational, b: Rational) => rational(a.n * b.d, a.d * b.n);
const constant = (a: Amount) => a.coefficients.every(zero);
const scale = (a: Amount, factor: Rational, usedSource = a.usedSource): Amount => ({
  constant: multiply(a.constant, factor), coefficients: a.coefficients.map(value => multiply(value, factor)), usedSource,
});
function decimal(text: string): Rational {
  const normalized = text.replaceAll(',', '');
  const [whole, fraction = ''] = normalized.split('.');
  return rational(BigInt((whole || '0') + fraction), 10n ** BigInt(fraction.length));
}
function normalize(text: string): string {
  return text.normalize('NFKC').replace(/[×✕xX]/g, '*').replace(/÷/g, '/')
    .replace(/[−–]/g, '-').replace(/[¥￥]/g, '').replace(/\b(?:CNY|RMB)\s*(?=[\d.])/gi, '')
    .replace(/(?:元|\bCNY\b|\bRMB\b)\s*$/gi, '').trim();
}

/** Validate source identities/amounts and compute their exact safe-cent total. */
export function validateNoteSourceFacts(facts: readonly PriceQuantityFact[]): bigint {
  if (!Array.isArray(facts) || !facts.length || facts.length > 32
    || facts.some(fact => !fact || typeof fact.dishId !== 'string' || !fact.dishId
      || !Number.isSafeInteger(fact.unitPriceCents) || fact.unitPriceCents < 0
      || !Number.isSafeInteger(fact.quantity) || fact.quantity < 1)
    || new Set(facts.map(fact => fact.dishId)).size !== facts.length) throw Error('Invalid note source facts');
  const totalCents = facts.reduce((sum, fact) => sum + BigInt(fact.unitPriceCents) * BigInt(fact.quantity), 0n);
  if (totalCents > BigInt(Number.MAX_SAFE_INTEGER)) throw Error('Source total outside safe cent range');
  return totalCents;
}

/** Sufficient expression/result evidence, not a free-text judge or proof of
 * Calculator use. Unsupported relations remain unproven; environment capacity
 * errors throw. Dish identities and note/state deltas are checked separately.
 */
export function getNoteExpressionEvidence(
  expression: string, statedTotal: string, facts: readonly PriceQuantityFact[],
): NoteExpressionEvidence {
  return checkEquations([{ expression, statedTotal }], facts, true);
}

export interface NoteEquation { expression: string; statedTotal: string }

/** Ordered, exact equations may reuse earlier numeric results as source-linked
 * intermediates. Every equation must be valid; at least one must prove the full
 * source total. This is written arithmetic evidence, never Calculator-use proof.
 */
export function getNoteEquationChainEvidence(equations: readonly NoteEquation[], facts: readonly PriceQuantityFact[]): NoteExpressionEvidence {
  return checkEquations(equations, facts, false);
}

function checkEquations(equations: readonly NoteEquation[], facts: readonly PriceQuantityFact[], single: boolean): NoteExpressionEvidence {
  const totalCents = validateNoteSourceFacts(facts);
  if (!Array.isArray(equations) || !equations.length || equations.some(equation => !equation
    || typeof equation.expression !== 'string' || typeof equation.statedTotal !== 'string')) throw Error('Invalid expression inputs');
  if (equations.length > 32 || equations.some(equation => equation.expression.length > 512 || equation.statedTotal.length > 128)) {
    throw new RangeError('Note expression exceeds diagnostic capacity');
  }
  const expected = rational(totalCents, 100n);
  const prices = [...new Set(facts.map(fact => fact.unitPriceCents).filter(price => price !== 0))];
  const expectedCoefficients = prices.map(price => rational(facts.filter(fact => fact.unitPriceCents === price)
    .reduce((sum, fact) => sum + BigInt(fact.quantity), 0n)));
  const priceValues = prices.map(price => rational(BigInt(price), 100n));
  let position = 0;
  let tokens = 0;
  let input = '';
  const aliases = new Map<string, Amount[]>();
  const numericKey = (value: Rational) => `${value.n}/${value.d}`;
  const amountKey = (a: Amount) => [a.constant, ...a.coefficients]
    .map(value => `${value.n}/${value.d}`).join(';') + `;${a.usedSource}`;
  const unique = (values: Amount[]) => {
    const map = new Map<string, Amount>();
    for (const value of values) {
      map.set(amountKey(value), value);
      if (map.size > MAX_VARIANTS) throw new RangeError('Note source-relation ambiguity exceeds diagnostic capacity');
    }
    return [...map.values()];
  };
  const skip = () => { while (/\s/.test(input[position] || '') && position < input.length) position++; };
  const consume = (token: string) => {
    skip(); if (input[position] !== token) return false;
    position++; if (++tokens > 192) throw new RangeError('Note token capacity exceeded'); return true;
  };
  const literal = (value: Rational): Value => {
    const base: Amount = { constant: value, coefficients: prices.map(() => ZERO), usedSource: false };
    const index = priceValues.findIndex(price => equal(value, price));
    const variants = [base];
    if (index >= 0) variants.push({ constant: ZERO,
      coefficients: prices.map((_, i) => i === index ? ONE : ZERO), usedSource: true });
    if (zero(value) && facts.some(fact => fact.unitPriceCents === 0)) {
      variants.push({ ...base, usedSource: true });
    }
    return { value, variants: unique([...variants, ...(aliases.get(numericKey(value)) ?? [])]) };
  };
  const combine = (a: Value, b: Value, operator: string): Value => {
    const value = operator === '+' ? add(a.value, b.value) : operator === '-' ? add(a.value, negate(b.value))
      : operator === '*' ? multiply(a.value, b.value) : divide(a.value, b.value);
    const variants: Amount[] = [];
    for (const left of a.variants) for (const right of b.variants) {
      const usedSource = left.usedSource || right.usedSource;
      if (operator === '+' || operator === '-') {
        const signed = operator === '-' ? scale(right, negate(ONE)) : right;
        variants.push({ constant: add(left.constant, signed.constant),
          coefficients: left.coefficients.map((coefficient, i) => add(coefficient, signed.coefficients[i])), usedSource });
      } else if (operator === '*') {
        if (constant(right)) variants.push(scale(left, right.constant, usedSource));
        if (constant(left)) variants.push(scale(right, left.constant, usedSource));
      } else if (constant(right) && !zero(right.constant)) {
        variants.push(scale(left, divide(ONE, right.constant), usedSource));
      }
    }
    return { value, variants: unique(variants) };
  };
  const primary = (): Expression => {
    if (consume('+')) return primary();
    if (consume('-')) return { kind: 'negate', item: primary() };
    if (consume('(')) { const item = sum(); if (!consume(')')) throw new UnsupportedSyntax(); return item; }
    skip();
    const match = /^(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)/.exec(input.slice(position));
    if (!match) throw new UnsupportedSyntax();
    position += match[0].length;
    if (++tokens > 192) throw new RangeError('Note token capacity exceeded');
    return { kind: 'literal', value: decimal(match[0]) };
  };
  const product = (): Expression => {
    let item = primary();
    while (true) {
      if (consume('*')) item = { kind: 'binary', operator: '*', left: item, right: primary() };
      else if (consume('/')) item = { kind: 'binary', operator: '/', left: item, right: primary() };
      else return item;
    }
  };
  const sum = (): Expression => {
    let item = product();
    while (true) {
      if (consume('+')) item = { kind: 'binary', operator: '+', left: item, right: product() };
      else if (consume('-')) item = { kind: 'binary', operator: '-', left: item, right: product() };
      else return item;
    }
  };
  const evaluate = (item: Expression): Value => {
    if (item.kind === 'literal') return literal(item.value);
    if (item.kind === 'negate') {
      const result = evaluate(item.item);
      return { value: negate(result.value), variants: result.variants.map(value => scale(value, negate(ONE))) };
    }
    return combine(evaluate(item.left), evaluate(item.right), item.operator);
  };
  try {
    let proofIndex: number | undefined;
    for (const [equationIndex, equation] of equations.entries()) {
      const result = normalize(equation.statedTotal);
      if (!/^[+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)$/.test(result)) {
        return { status: 'unproven', reason: 'unsupported_syntax' };
      }
      const stated = result.startsWith('-') ? negate(decimal(result.slice(1))) : decimal(result.replace(/^\+/, ''));
      if (single && !equal(stated, expected)) return { status: 'contradicted', reason: 'wrong_stated_total' };
      input = normalize(equation.expression); position = 0; tokens = 0;
      const tree = sum(); skip();
      if (position !== input.length) throw new UnsupportedSyntax();
      // Fully parse before arithmetic; never cache an unverified claimed result.
      const parsed = evaluate(tree);
      if (!equal(parsed.value, stated)) return { status: 'contradicted',
        reason: single ? 'wrong_expression_total' : 'wrong_intermediate_total' };
      if (equal(parsed.value, expected) && parsed.variants.some(value => value.usedSource && zero(value.constant)
        && value.coefficients.every((coefficient, i) => equal(coefficient, expectedCoefficients[i])))) proofIndex ??= equationIndex;
      // Literals are positive; a negative intermediate can be referenced with
      // unary minus by caching the sign-reversed source contribution.
      const negative = parsed.value.n < 0n;
      const key = numericKey(negative ? negate(parsed.value) : parsed.value);
      const variants = negative ? parsed.variants.map(value => scale(value, negate(ONE))) : parsed.variants;
      aliases.set(key, unique([...(aliases.get(key) ?? []), ...variants]));
    }
    if (proofIndex !== undefined) return single ? { status: 'proven', reason: 'source_linear_expression' }
      : { status: 'proven', reason: 'source_linear_expression', equationIndex: proofIndex };
    return { status: 'unproven', reason: 'source_relation_not_proven' };
  } catch (error) {
    if (error instanceof UnsupportedSyntax) return { status: 'unproven', reason: 'unsupported_syntax' };
    if (error instanceof DivisionByZero) return { status: 'contradicted', reason: 'division_by_zero' };
    throw error;
  }
}
