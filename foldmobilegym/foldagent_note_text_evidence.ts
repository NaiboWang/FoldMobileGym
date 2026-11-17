import type { PriceQuantityFact } from './foldagent_price_total_evidence';
import { getNoteEquationChainEvidence, getNoteExpressionEvidence, validateNoteSourceFacts } from './foldagent_note_expression_evidence';

export interface NamedNoteSourceFact extends PriceQuantityFact { name?: string }
export interface NoteTextEvidence {
  status: 'proven' | 'contradicted' | 'unproven';
  reason: string;
  expression?: string;
  statedTotal?: string;
}
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const expressionLabel = /^(?:算式|计算式|计算|expression|calculation)\s*[:：]\s*/i;
const totalLabel = /^(?:总价|总额|合计|总计|结果|total|result)\s*[:：]\s*/i;
const amount = (cents: number) => {
  const value = BigInt(cents);
  return `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
};

/** Sufficient evidence for explicit ordered note equations, or one labelled
 * expression plus total. Recognized named dish claims must agree. This is NOT
 * a general natural-language judge, note-delta check, or Calculator-use proof.
 * Ordered intermediate equations are verified before reuse. Unparsed named
 * claims and ambiguous mixtures of equation/labelled-expression layouts defer.
 */
export function getNoteTextEvidence(content: string, facts: readonly NamedNoteSourceFact[]): NoteTextEvidence {
  validateNoteSourceFacts(facts);
  if (facts.some(fact => fact.name !== undefined && (typeof fact.name !== 'string' || !fact.name.trim()))) {
    throw Error('Invalid note source name');
  }
  if (typeof content !== 'string') throw Error('Invalid note text');
  if (content.length > 8192) throw new RangeError('Note text exceeds diagnostic capacity');
  const lines = content.normalize('NFKC').split(/\r?\n/);
  if (lines.length > 128) throw new RangeError('Note line capacity exceeded');
  const equations: Array<{ expression: string; total: string }> = [];
  const expressions: string[] = [];
  const totals: string[] = [];
  let unknownClaim = false;
  for (const raw of lines) {
    let line = raw.trim();
    if (!line || /^```(?:math|text)?\s*$/i.test(line)) continue;
    // Do not strip a unary minus before a number as if it were a Markdown bullet.
    line = line.replace(/^[*-]\s+(?=[^\d.(+-])/, '');
    if (line.startsWith('$$') && line.endsWith('$$')) line = line.slice(2, -2).trim();
    // Numeric source names must not turn a clearly arithmetic equation into
    // a named claim. Named-variable equations remain unsupported by the parser.
    const matchingNames = line.includes('=') ? [] : facts.filter(fact => fact.name
      && line.toLowerCase().includes(fact.name.normalize('NFKC').toLowerCase()));
    if (matchingNames.length) {
      const claims = matchingNames.map(fact => ({ fact,
        match: new RegExp(`^${escaped(fact.name!.normalize('NFKC'))}\\s*[×xX*]\\s*([+-]?\\d+)\\s*(?:[,;]\\s*(?:单价|unit price)\\s*:?\\s*(.+))?$`, 'i').exec(line),
      })).filter(claim => claim.match);
      if (claims.length !== 1) { unknownClaim = true; continue; }
      const { fact, match: matched } = claims[0];
      const match = matched!;
      if (BigInt(match[1]) !== BigInt(fact.quantity)) return { status: 'contradicted', reason: 'wrong_source_quantity' };
      if (match[2]) {
        const price = getNoteExpressionEvidence(amount(fact.unitPriceCents), match[2], [{ ...fact, quantity: 1 }]);
        if (price.status === 'contradicted') return { status: 'contradicted', reason: 'wrong_source_unit_price' };
        if (price.status !== 'proven') unknownClaim = true;
      }
      continue;
    }
    const equalities = line.split('=');
    if (equalities.length === 2) {
      equations.push({ expression: equalities[0].replace(expressionLabel, '').trim(),
        total: equalities[1].replace(totalLabel, '').trim() });
    } else if (equalities.length > 2) return { status: 'unproven', reason: 'ambiguous_expressions' };
    else if (expressionLabel.test(line)) expressions.push(line.replace(expressionLabel, '').trim());
    else if (totalLabel.test(line)) totals.push(line.replace(totalLabel, '').trim());
    else if (/^(?:算式|计算式|计算|总价|总额|合计|总计|结果|expression|calculation|total|result)(?:\b|是|为|\s|[:：])/i.test(line)) {
      return { status: 'unproven', reason: 'unsupported_formula_claim' };
    }
  }
  if (unknownClaim) return { status: 'unproven', reason: 'unsupported_source_claim' };
  if (expressions.length > 1 || (equations.length && expressions.length)) {
    return { status: 'unproven', reason: 'ambiguous_expressions' };
  }
  const candidate = equations.at(-1) ?? (expressions.length === 1 && totals.length
    ? { expression: expressions[0], total: totals[0] } : undefined);
  if (!candidate) return { status: 'unproven', reason: 'no_expression_and_total' };
  if (equations.length > 1) {
    const chain = getNoteEquationChainEvidence(equations.map(equation => ({
      expression: equation.expression, statedTotal: equation.total,
    })), facts);
    // Additional explicitly labelled totals are independent claims. Verify
    // their exact value without mistaking a summary numeral for source proof.
    const checks = totals.map(total => getNoteExpressionEvidence(amount(Number(validateNoteSourceFacts(facts))), total, facts));
    const contradiction = checks.find(check => check.status === 'contradicted');
    const unsupported = checks.find(check => check.status === 'unproven' && check.reason === 'unsupported_syntax');
    const proved = chain.status === 'proven' ? equations[chain.equationIndex!] : candidate;
    return { ...(contradiction ?? (chain.status === 'contradicted' ? chain : unsupported ?? chain)),
      expression: proved.expression, statedTotal: proved.total };
  }
  // Every explicitly labelled total must agree, not just the one convenient to
  // the checker. Unrecognized syntax is deferred, never silently ignored.
  const checks = [candidate.total, ...totals].map(total => getNoteExpressionEvidence(candidate.expression, total, facts));
  const contradicted = checks.find(check => check.status === 'contradicted');
  const result = contradicted ?? checks.find(check => check.status === 'unproven') ?? checks[0];
  return { ...result, expression: candidate.expression, statedTotal: candidate.total };
}
