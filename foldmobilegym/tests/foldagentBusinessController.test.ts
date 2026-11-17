import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { combineEvidenceChecks } from '../foldagent_evaluator';
import { getPriceNoteTaskContract } from '../foldagent_price_note_judge';

const contract = { shopId: 'shop', quantities: { a: 2, b: 1 } };
const rule = (path: string, op: string, value: unknown) => ({ path, op, value });
function task() {
  return { id: 'public-controller-unit', pair_id: 'public', apps: ['meituan_waimai', 'calculator', 'notes'],
    seed_contract: { shop_id: 'shop', dish_ids: ['a', 'b'], price_note: structuredClone(contract) },
    event_plan: [], evaluator: { success_all: [rule('benchmark.anchors.public.source_facts_verified', 'eq', true),
      rule('apps.notes.created_count', 'delta_eq', 1)], safety_all: [rule('telemetry.forbidden_actions', 'eq', 0)],
    must_have_events: [], require_post_transition_action: false, max_invalid_actions: 0, max_repeated_actions: 1 } };
}
function initial() {
  return { apps: { meituan_waimai: { shops: { shop: { id: 'shop', name: 'Public shop', dishes: [
    { id: 'a', name: 'Dish A', price: 12.3 }, { id: 'b', name: 'Dish B', price: 8.75 },
  ] } }, cart: { shopId: 'shop', quantities: { a: 1 } }, orders: {}, user: {}, nextOrderNumber: 1 },
  calculator: { calculationCount: 0, calculations: [] },
  notes: { createdCount: 0, created_count: 0, notes: [{ id: 'old', content: 'Keep unchanged' }] } } };
}
function final(content = '12.3*2+8.75=33.35') {
  const state: any = initial();
  state.apps.calculator = { calculationCount: 2, calculations: [
    { id: 1, left: 12.3, operator: '*', right: 2, result: 24.6, displayResult: '24.6', origin: 'equals' },
    { id: 2, left: 24.6, operator: '+', right: 8.75, result: 33.35, displayResult: '33.35', origin: 'equals' },
  ] };
  state.apps.notes = { createdCount: 1, created_count: 1, notes: [...state.apps.notes.notes, { id: 'new', content }] };
  return state;
}
let Controller: any, current: any;
beforeAll(async () => {
  vi.stubGlobal('window', { addEventListener: vi.fn(), __SIM__: { getState: () => current },
    __OS__: { getState: () => ({ activeAppId: 'notes' }), getAppRoute: () => ({ path: '/' }) },
    __FOLDAGENT__: { getState: () => ({ posture: 'unfolded', layout_id: 'inner_wide' }) } });
  vi.stubGlobal('document', { querySelectorAll: () => [], activeElement: null });
  for (const name of ['HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLSelectElement']) vi.stubGlobal(name, class {});
  Controller = (await import('../foldagent_benchmark')).FoldAgentBenchmarkController;
});
beforeEach(() => { current = final(); });
function harness() {
  const controller: any = new Controller();
  // Synthetic report-composition unit, not controller fault/UI qualification.
  controller.task = task(); controller.initialState = initial();
  controller.anchors = { source_facts_verified: true };
  return controller;
}

describe('Agent posture policy', () => {
  it.each([
    { metadata: { benchmark_profile: 'unfolded_static_v1' } },
    { metadata: { benchmark_profile: 'unfolded_static_multi_window_v1' } },
    { event_plan: [{ controller: 'benchmark' }] },
    { recovery: {} },
  ])('rejects incompatible active-fold tasks before replacing the episode: %j', async change => {
    const controller = harness(), oldTask = controller.task;
    await expect(controller.start({ ...task(), ...change }, { allowAgentPosture: true })).rejects.toThrow(/fold\/unfold/);
    expect(controller.task).toBe(oldTask);
  });

  it('requires run authorization, and stop revokes it', async () => {
    const controller = harness();
    expect((await controller.performAgentPostureAction('fold')).valid).toBe(false);
    controller.allowAgentPosture = true;
    controller.stop();
    expect((await controller.performAgentPostureAction('unfold')).valid).toBe(false);
    expect((await controller.performAgentPostureAction('set_posture')).valid).toBe(false);
  });
});
describe('Explicit business-contract admission', () => {
  it.each(['unseeded', 'seeded', 'split', 'reset-failure', 'readiness-failure'])
    ('completes same-document reset only after valid %s setup', async mode => {
      const simulator = (window as any).__SIM__;
      const foldable = (window as any).__FOLDAGENT__;
      const previous = { reset: simulator.resetState, set: simulator.setState,
        ready: simulator.waitForData, posture: foldable.setPosture, window: foldable.setMultiWindow };
      const calls: string[] = [];
      simulator.resetState = async () => {
        calls.push('reset');
        if (mode === 'reset-failure') throw Error('reset failed');
      };
      simulator.waitForData = async () => {
        calls.push('ready');
        if (mode === 'readiness-failure') throw Error('data unavailable');
      };
      simulator.setState = vi.fn(() => { calls.push('restore'); });
      foldable.setMultiWindow = vi.fn((value: string) => { calls.push(`window:${value}`); });
      foldable.setPosture = () => { calls.push('posture'); throw Error('setup probe finished'); };
      const data = { ...task(), initial_window: { posture: 'unfolded', layout: 'inner_wide',
        focused_app: 'meituan_waimai', ...(mode === 'split'
          ? { mode: 'split', split_apps: ['meituan_waimai', 'calculator'], split_orientation: 'side_by_side' }
          : { mode: 'fullscreen' }) } };
      const options = mode === 'seeded' ? { seedState: { raw_apps: initial().apps } } : {};
      try {
        await expect(new Controller().start(data, options)).rejects.toThrow(
          mode === 'reset-failure' ? 'reset failed' : mode === 'readiness-failure'
            ? 'data unavailable' : 'setup probe finished');
        expect(calls).toEqual(mode === 'reset-failure' ? ['reset']
          : mode === 'readiness-failure' ? ['reset', 'ready'] : ['reset', 'ready', 'restore', 'window:fullscreen', 'posture']);
        if (mode === 'unseeded') expect(simulator.setState).toHaveBeenCalledWith({}, { deep: false, reload: false });
        if (mode === 'seeded') expect(simulator.setState).toHaveBeenCalledWith(
          { apps: initial().apps }, { deep: false, reload: false });
      } finally {
        simulator.resetState = previous.reset; simulator.setState = previous.set;
        simulator.waitForData = previous.ready; foldable.setPosture = previous.posture;
        foldable.setMultiWindow = previous.window;
      }
    });
  it.each([
    ['split', 'Initial split_apps must contain two distinct task apps in pane order'],
    ['freeform', 'Unsupported initial window mode'],
  ])('rejects malformed or unsupported initial %s before reset or episode replacement', async (mode, message) => {
    const controller = harness();
    const previousTask = controller.task;
    controller.step = 7;
    const simulator = (window as any).__SIM__;
    const oldReset = simulator.resetState;
    const reset = vi.fn();
    simulator.resetState = reset;
    try {
      await expect(controller.start({ ...task(), initial_window: {
        posture: 'unfolded', layout: 'inner_wide', focused_app: 'meituan_waimai', mode,
      } })).rejects.toThrow(message);
      expect(reset).not.toHaveBeenCalled();
      expect(controller.task).toBe(previousTask);
      expect(controller.step).toBe(7);
    } finally { simulator.resetState = oldReset; }
  });
  it('does not opt legacy tasks in by app list or ID', () => {
    const data: any = task(); delete data.seed_contract.price_note;
    expect(getPriceNoteTaskContract(data)).toBeNull();
  });
  it('accepts matched identities, source delivery and exact creation guards', () => {
    expect(getPriceNoteTaskContract(task())).toEqual(contract);
  });
  it.each(['apps', 'shop', 'dish', 'quantity', 'delivery', 'creation', 'null-marker'])
    ('rejects inconsistent task contract %s', mode => {
      const data: any = task();
      if (mode === 'apps') data.apps.reverse();
      if (mode === 'shop') data.seed_contract.shop_id = 'other';
      if (mode === 'dish') data.seed_contract.dish_ids = ['a', 'a'];
      if (mode === 'quantity') data.seed_contract.price_note.quantities.a = 0;
      if (mode === 'delivery') data.evaluator.success_all.shift();
      if (mode === 'creation') data.evaluator.success_all.pop();
      if (mode === 'null-marker') data.seed_contract.price_note = null;
      expect(() => getPriceNoteTaskContract(data)).toThrow();
    });
});
describe('Main controller composes business evidence with independent gates', () => {
  it.each([['12.3*2+8.75=33.35', true], ['(12.3*2+8.75)^1=33.35', null], ['12.3*2+8.75=33.36', false]])
    ('reports %s without boolean coercion', (content, passed) => {
      current = final(String(content));
      expect(harness().getReport().passed).toBe(passed);
    });
  it('does not change legacy boolean report semantics', () => {
    const controller = harness(); delete controller.task.seed_contract.price_note;
    current = final('(12.3*2+8.75)^1=33.35');
    expect(controller.getReport().passed).toBe(true);
    expect(controller.getReport()).not.toHaveProperty('business_judgment');
  });
  it.each(['delivery', 'event', 'post-action', 'safety', 'interaction'])('keeps independent failure gate %s', mode => {
    current = final('(12.3*2+8.75)^1=33.35');
    const controller = harness();
    if (mode === 'delivery') controller.anchors.source_facts_verified = false;
    if (mode === 'event') controller.task.evaluator.must_have_events = ['missing'];
    if (mode === 'post-action') {
      controller.task.evaluator.must_have_events = ['fired']; controller.fired.add('fired');
      controller.task.evaluator.require_post_transition_action = true;
      controller.evidence = [{ event_id: 'fired', trigger_step: 1 }];
    }
    if (mode === 'safety') controller.recordViolation('forbidden_actions');
    if (mode === 'interaction') controller.invalidActions = 1;
    expect(controller.getReport().passed).toBe(false);
  });
  it('never establishes a completion checkpoint from unresolved business evidence', () => {
    const controller = harness(); current = final('(12.3*2+8.75)^1=33.35');
    const unresolved = controller.getReport();
    expect(controller.businessGoalSatisfied(unresolved.final_state)).toBe(false);
    current = final();
    expect(controller.businessGoalSatisfied(controller.getReport().final_state)).toBe(true);
  });
  it('retains unknown recovery timing without hiding context failure or definite lateness', () => {
    const controller = harness(); current = final('(12.3*2+8.75)^1=33.35');
    controller.task.recovery = { context_rules: [] };
    controller.evidence = [{ event_id: 'recovery', trigger_step: 1, recovery_deadline_step: 5,
      context_retained: true, context_checks: [{ passed: true }] }];
    expect(controller.getReport()).toMatchObject({ passed: null, recovery: { passed: null, within_budget: null, completion_step: null } });
    controller.evidence[0].context_retained = false;
    expect(controller.getReport().passed).toBe(false);
    controller.evidence[0].context_retained = true; current = final(); controller.goalSatisfiedStep = 6;
    expect(controller.getReport()).toMatchObject({ passed: false, recovery: { passed: false, within_budget: false } });
  });
  it('propagates malformed source data as an environment error', () => {
    const controller = harness(); delete controller.initialState.apps.meituan_waimai.shops;
    expect(() => controller.getReport()).toThrow();
  });
  it.each(['missing', 'changed', 'preserved'])('requires all declared retained app checks: %s', mode => {
    const controller = harness();
    controller.task.recovery = { app_id: 'notes', retained_apps: ['calculator', 'meituan_waimai'], context_rules: [] };
    controller.evidence = [{ event_id: 'recovery', trigger_step: 1, recovery_deadline_step: 5, context_retained: true,
      context_checks: [{ name: 'persisted_state', passed: true }, { name: 'retained_app:calculator', passed: mode !== 'changed' },
        ...(mode === 'missing' ? [] : [{ name: 'retained_app:meituan_waimai', passed: true }])] }];
    controller.goalSatisfiedStep = 3;
    expect(controller.getReport().passed).toBe(mode === 'preserved');
  });
});
describe('Tri-state conjunction', () => {
  it.each([[true, true, true], [true, null, null], [null, false, false], [false, true, false], [null, null, null]])
    ('combines %s and %s as %s', (left, right, expected) => {
      expect(combineEvidenceChecks([left, right])).toBe(expected);
    });
});

describe('Correct or unresolved answers cannot bypass multi-event process gates', () => {
  const cases = [
    ['valid-after-both', true, true, true, true],
    ['missing-first', false, false, true, false],
    ['missing-second', false, true, false, false],
    ['no-later-action', true, false, false, false],
    ['same-step', true, true, false, false],
    ['invalid-later-action', true, false, false, false],
    ['ineffectful-later-action', true, false, false, false],
    ['between-events-only', true, true, false, false],
    ['forbidden-after-both', true, true, true, false],
    ['invalid-budget', true, true, true, false],
    ['repeated-budget', true, true, true, false],
  ] as const;
  for (const [content, business] of [
    ['12.3*2+8.75=33.35', true],
    ['(12.3*2+8.75)^1=33.35', null],
  ] as const) {
    it.each(cases)(`${business === true ? 'proven' : 'unresolved'} answer: %s`,
      (mode, coverage, firstPost, secondPost, gatesPass) => {
        current = final(content);
        const controller = harness();
        controller.task.evaluator.must_have_events = ['first', 'second'];
        controller.task.evaluator.require_post_transition_action = true;
        // Explicit synthetic event/action histories test getReport, not actual
        // browser transitions. No public task or episode is qualified by these.
        controller.evidence = [
          ...(mode === 'missing-first' ? [] : [{ event_id: 'first', trigger_step: 1 }]),
          ...(mode === 'missing-second' ? [] : [{ event_id: 'second', trigger_step: 3 }]),
        ];
        for (const event of controller.evidence) controller.fired.add(event.event_id);
        const action = (step: number, valid = true, effectful = true) => ({ step, valid, effectful });
        controller.actions = mode === 'no-later-action' ? []
          : mode === 'same-step' ? [action(3)]
          : mode === 'invalid-later-action' ? [action(4, false)]
          : mode === 'ineffectful-later-action' ? [action(4, true, false)]
          : mode === 'between-events-only' ? [action(2)] : [action(4)];
        if (mode === 'forbidden-after-both') controller.recordViolation('forbidden_actions');
        if (mode === 'invalid-budget') controller.invalidActions = 1;
        if (mode === 'repeated-budget') controller.repeatedActions = 2;
        const report = controller.getReport();
        expect(report.business_judgment.passed).toBe(business);
        expect(report.target_checks.every((check: any) => check.passed)).toBe(true);
        expect(report.event_coverage).toBe(coverage);
        expect(report.post_transition_by_event.first === true).toBe(firstPost);
        expect(report.post_transition_by_event.second === true).toBe(secondPost);
        expect(report.post_transition_action).toBe(firstPost && secondPost);
        expect(report.passed).toBe(gatesPass ? business : false);
      });
  }
});

describe('Proven answers still require a genuine recovery completion boundary', () => {
  it.each([
    ['no-fault-evidence', null, false],
    ['before-fault', 1, false],
    ['same-step-as-fault', 2, false],
    ['next-step', 3, true],
    ['exact-deadline', 5, true],
    ['one-step-late', 6, false],
  ] as const)('%s', (mode, completion, expected) => {
    const controller = harness();
    controller.task.recovery = { app_id: 'notes', context_rules: [] };
    if (mode !== 'no-fault-evidence') controller.evidence = [{ event_id: 'fault', trigger_step: 2,
      recovery_deadline_step: 5, context_retained: true,
      context_checks: [{ name: 'persisted_state', passed: true }] }];
    controller.goalSatisfiedStep = completion;
    const report = controller.getReport();
    expect(report.business_judgment.passed).toBe(true);
    expect(report.recovery.passed).toBe(expected);
    expect(report.passed).toBe(expected);
    expect(report.recovery.completion_step).toBe(completion !== null && completion > 2 ? completion : null);
    expect(report.recovery.recovery_steps).toBe(completion !== null && completion > 2 ? completion - 2 : null);
  });
});
