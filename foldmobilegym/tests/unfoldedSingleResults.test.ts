import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { singleAppContract } from '../foldagent_single_app_contract';
const root = path.resolve(import.meta.dirname, '../..');
const read = (file: string) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const allRows = read('tasks/unfolded_static/single_app/manifest.json').tasks;
const v3 = allRows.filter((row: any) => read(row.task).seed_contract?.single_app_v3 !== undefined);
const results = allRows.filter((row: any) => read(row.task).seed_contract?.single_app_v3 === undefined);
let Benchmark: typeof import('../foldagent_benchmark').FoldAgentBenchmarkController;
beforeAll(async () => {
  vi.stubGlobal('window', { addEventListener: vi.fn() });
  Benchmark = (await import('../foldagent_benchmark')).FoldAgentBenchmarkController;
});
afterAll(() => { vi.unstubAllGlobals(); });
const setPath = (state: any, location: string, value: unknown) => {
  const parts = location.split('.'); let node = state;
  for (const key of parts.slice(0, -1)) node = node[key] ??= {};
  node[parts.at(-1)!] = value;
};

/** Authored outcome states only: never alters a task, seed, judge or GUI default. */
function completed(row: any, initial: any) {
  const gold = read(path.posix.join(path.posix.dirname(row.seed), 'gold.private.json'));
  const state = structuredClone(initial), app = state.apps[gold.app], d = gold.data;
  switch (row.card) {
    case 'SA15': app.display = String(d.result); app.calculations = [{ result: d.result }]; break;
    case 'SA16': app.settings.general.refreshSoundEnabled = d.value; break;
    case 'SA17': app.cartItems = [{ productId: d.id, variantId: d.variant.id, quantity: d.quantity }]; break;
    case 'SA18': app.cart.shopId = d.shop_id; app.cart.quantities = { [d.dish_id]: d.quantity }; break;
    case 'SA19': state.runtime.app_routes.appstore = '/app/' + d.id; break;
    case 'SA20': app.savedItems.push(d.id); break;
    case 'SA21': app.user.favoritesFolders.find((folder: any) => folder.id === 'fav_default').videoIds.push(d.id); break;
    case 'SA22': app.customPlaylists.push({ id: 'authored-playlist', title: d.title, trackIds: [] }); break;
    case 'SA23': app.user.savedPostIds.push(d.id); break;
    case 'SA24': app.user.bookmarkedPostIds.push(d.id); break;
    case 'SA25': app.user.collectedNotes.push(d.id); break;
    case 'SA26': app.shelf.push({ bookId: d.id }); break;
    case 'SA27': app.settings.highContrast = d.value; break;
    case 'SA28': app.settings[d.field] = d.value; break;
    case 'SA29': state.runtime.app_routes.theme_store = '/item/theme/' + d.id; break;
    default: throw Error('Uncovered result-only task: ' + row.card);
  }
  return state;
}

describe('Expanded single-app result contracts use the actual controller rules', () => {
  it('partitions every manifest row without losing the original v3 cases or new result-only configurations', () => {
    expect(allRows).toHaveLength(56);
    expect(v3).toHaveLength(26); expect(results).toHaveLength(30);
    expect(new Set([...v3, ...results].map((row: any) => row.id)).size).toBe(allRows.length);
    for (const row of results) expect(read(row.task).adapter.contract_id).toBe('result_rules_v1');
  });
  for (const row of results) it(`${row.id}: real dispatcher, no-op, positive, each wrong result and each safety violation`, () => {
    const task = read(row.task), seed = read(row.seed);
    expect(singleAppContract(task)).toBeNull();
    const initial = { apps: structuredClone(seed.raw_apps), os: structuredClone(seed.os),
      runtime: { active_app_id: task.apps[0], app_routes: { [task.apps[0]]: '/' } },
      telemetry: { real_world_side_effects: 0, forbidden_actions: 0 },
      foldable: { posture: 'unfolded', active_display: 'inner', multi_window: { mode: 'fullscreen' } } };
    // The X fixture overrides posts only; actual reset retains the packaged user.
    // Copy the real unmodified defaults rather than inventing task/default data.
    if (initial.apps.x) initial.apps.x.user ??= structuredClone(read('foldmobilegym/apps/X/data/defaults.json').user);
    // Bypass browser event-listener construction only, not the real grading methods.
    const controller = Object.assign(Object.create(Benchmark.prototype), { task, initialState: initial });
    const before = structuredClone(initial), current = completed(row, initial);
    expect(controller.businessJudgment(current)).toBeNull();
    expect(controller.businessGoalSatisfied(initial)).toBe(false);
    expect(controller.businessGoalSatisfied(current)).toBe(true);
    for (const rule of task.evaluator.success_all) {
      expect(controller.checkRule(rule, current)).toBe(true);
      const wrong = structuredClone(current); setPath(wrong, rule.path, '__wrong_result__');
      expect(controller.checkRule(rule, wrong)).toBe(false);
      expect(controller.businessGoalSatisfied(wrong)).toBe(false);
    }
    for (const rule of task.evaluator.safety_all) {
      expect(controller.checkRule(rule, current)).toBe(true);
      const unsafe = structuredClone(current); setPath(unsafe, rule.path, '__safety_violation__');
      expect(controller.checkRule(rule, unsafe)).toBe(false);
    }
    expect(initial).toEqual(before);
  });
});
