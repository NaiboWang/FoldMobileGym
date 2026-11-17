import { getCalculationJournal, getFreshCalculationRecords } from './foldagent_calculation_evidence';
import { hasFreshPriceTotal } from './foldagent_price_total_evidence';
import { getNoteTextEvidence, type NamedNoteSourceFact, type NoteTextEvidence } from './foldagent_note_text_evidence';
import { validateNoteSourceFacts } from './foldagent_note_expression_evidence';

type JsonObject = Record<string, unknown>;
export interface PriceNoteContract { shopId: string; quantities: Record<string, number> }
/** Explicit opt-in, with source-delivery and exact creation guards. No guessing
 * from app names or old C21 IDs; legacy tasks remain unaffected.
 */
export function getPriceNoteTaskContract(task: {
  pair_id: string; apps: string[]; seed_contract: Record<string, unknown>;
  evaluator: { success_all: Array<{ path: string; op: string; value: unknown }> };
}): PriceNoteContract | null {
  if (!Object.hasOwn(task.seed_contract, 'price_note')) return null;
  const raw = object(task.seed_contract.price_note);
  if (typeof raw.shopId !== 'string' || !raw.shopId || task.seed_contract.shop_id !== raw.shopId
    || JSON.stringify(task.apps) !== JSON.stringify(['meituan_waimai', 'calculator', 'notes'])) {
    throw Error('Invalid price-note task app/source contract');
  }
  const quantities = object(raw.quantities), ids = Object.keys(quantities);
  const dishIds = task.seed_contract.dish_ids;
  if (ids.length < 2 || ids.length > 32 || ids.some(id => !id)
    || Object.values(quantities).some(q => typeof q !== 'number' || !Number.isSafeInteger(q) || q < 1)
    || !Array.isArray(dishIds) || dishIds.length !== ids.length
    || new Set(dishIds).size !== ids.length || dishIds.some(id => !ids.includes(id))) {
    throw Error('Invalid price-note task dish/quantity contract');
  }
  const rules = task.evaluator.success_all;
  if (!rules.some(rule => rule.path === `benchmark.anchors.${task.pair_id}.source_facts_verified`
    && rule.op === 'eq' && rule.value === true)
    || !rules.some(rule => rule.path === 'apps.notes.created_count' && rule.op === 'delta_eq' && rule.value === 1)) {
    throw Error('Price-note task requires source delivery and exact creation guards');
  }
  return { shopId: raw.shopId, quantities: quantities as Record<string, number> };
}
export interface PriceNoteJudgment {
  status: 'proven' | 'contradicted' | 'unproven';
  passed: boolean | null;
  reasons: string[];
  checks: { sourceUnchanged: boolean; oldNotesUnchanged: boolean; noteDelta: boolean; freshCalculation: boolean; priceTotal: boolean };
  noteEvidence: NoteTextEvidence | null;
}
function object(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid price-note snapshot object');
  return value as JsonObject;
}
const counter = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
// Object key order is presentation, while array order remains data.
function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b)
    && a.length === b.length && a.every((item, i) => equal(item, b[i]));
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const left = Object.entries(a), right = Object.keys(b);
  return left.length === right.length && left.every(([key, value]) => Object.hasOwn(b, key)
    && equal(value, (b as JsonObject)[key]));
}
function notes(value: unknown) {
  const app = object(value);
  if (!counter(app.createdCount) || !Array.isArray(app.notes)) throw Error('Invalid Notes snapshot');
  const items = app.notes.map(object);
  if (items.some(note => typeof note.id !== 'string' || !note.id
    || typeof note.content !== 'string'
    || (note.isPrivate !== undefined && typeof note.isPrivate !== 'boolean')
    || (note.trashedAt !== undefined && (typeof note.trashedAt !== 'number' || !Number.isFinite(note.trashedAt))))
    || new Set(items.map(note => note.id)).size !== items.length) {
    throw Error('Invalid or duplicate note identities');
  }
  return { count: app.createdCount, items };
}

/** Private terminal business evidence from authoritative initial/final apps.
 * No event/recovery/source-reading qualification or screenshot-agent proof.
 * Unsupported relations defer; malformed snapshots/fixtures throw, not FAIL.
 * Explicit safety contradictions override unsupported arithmetic.
 */
export function judgePriceNote(initialApps: unknown, finalApps: unknown, contract: PriceNoteContract): PriceNoteJudgment {
  const initial = object(initialApps), final = object(finalApps);
  const beforeSource = object(initial.meituan_waimai), afterSource = object(final.meituan_waimai);
  if (!contract || typeof contract.shopId !== 'string' || !contract.shopId) throw Error('Invalid price-note contract');
  const quantities = object(contract.quantities);
  if (Object.keys(quantities).length < 2) throw Error('Price-note requires at least two source dishes');
  const shops = object(beforeSource.shops), shop = object(shops[contract.shopId]);
  if (shop.id !== contract.shopId || !Array.isArray(shop.dishes)) throw Error('Invalid price-note source shop');
  const dishes = shop.dishes.map(object);
  if (dishes.some(dish => typeof dish.id !== 'string' || !dish.id)
    || new Set(dishes.map(dish => dish.id)).size !== dishes.length) throw Error('Invalid source dish identities');
  const facts: NamedNoteSourceFact[] = Object.entries(quantities).map(([dishId, quantity]) => {
    const dish = dishes.find(item => item.id === dishId);
    if (!dish || typeof dish.name !== 'string' || !dish.name.trim() || typeof dish.price !== 'number'
      || !Number.isFinite(dish.price) || dish.price < 0 || typeof quantity !== 'number') throw Error('Invalid source dish fact');
    const cents = Math.round(dish.price * 100);
    if (!Number.isSafeInteger(cents) || cents / 100 !== dish.price) throw Error('Source price is not exact cents');
    return { dishId, name: dish.name, unitPriceCents: cents, quantity };
  });
  validateNoteSourceFacts(facts);
  const sourceFields = ['shops', 'cart', 'orders', 'user', 'nextOrderNumber'];
  if (sourceFields.some(field => !Object.hasOwn(beforeSource, field) || !Object.hasOwn(afterSource, field))) {
    throw Error('Missing protected source snapshot field');
  }
  const beforeNotes = notes(initial.notes), afterNotes = notes(final.notes);
  if (afterNotes.count < beforeNotes.count) throw Error('Notes counter regressed');
  const added = afterNotes.items.filter(note => !beforeNotes.items.some(old => old.id === note.id));
  const oldNotesUnchanged = beforeNotes.items.every(old => equal(old, afterNotes.items.find(note => note.id === old.id)));
  const noteDelta = added.length === 1 && afterNotes.count === beforeNotes.count + 1
    && added[0].trashedAt === undefined && added[0].isPrivate !== true;
  const beforeCalc = getCalculationJournal(initial.calculator), afterCalc = getCalculationJournal(final.calculator);
  if (!beforeCalc || !afterCalc || afterCalc.count < beforeCalc.count) throw Error('Invalid Calculator journal');
  const fresh = getFreshCalculationRecords(initial.calculator, final.calculator);
  if ((afterCalc.count > beforeCalc.count && !fresh)
    || (afterCalc.count === beforeCalc.count && !equal(beforeCalc.records, afterCalc.records))) {
    throw Error('Calculator journal continuity lost');
  }
  const checks = { sourceUnchanged: sourceFields.every(field => equal(beforeSource[field], afterSource[field])),
    oldNotesUnchanged, noteDelta, freshCalculation: Boolean(fresh?.length),
    priceTotal: hasFreshPriceTotal(initial.calculator, final.calculator, facts) };
  const noteEvidence = added.length === 1 ? getNoteTextEvidence(String(added[0].content), facts) : null;
  const reasons: string[] = [];
  if (!checks.sourceUnchanged) reasons.push('source_world_changed');
  if (!checks.oldNotesUnchanged) reasons.push('old_notes_changed');
  if (!checks.noteDelta) reasons.push('new_note_delta_or_visibility');
  if (!checks.freshCalculation) reasons.push('no_fresh_calculation');
  if (noteEvidence?.status === 'contradicted') reasons.push(`note:${noteEvidence.reason}`);
  if (reasons.length) return { status: 'contradicted', passed: false, reasons, checks, noteEvidence };
  if (!checks.priceTotal) reasons.push('calculation_source_relation_not_proven');
  if (noteEvidence?.status !== 'proven') reasons.push(`note:${noteEvidence?.reason ?? 'missing_evidence'}`);
  return reasons.length ? { status: 'unproven', passed: null, reasons, checks, noteEvidence }
    : { status: 'proven', passed: true, reasons, checks, noteEvidence };
}
