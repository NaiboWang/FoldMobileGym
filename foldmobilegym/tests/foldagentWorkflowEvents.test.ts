import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Synthetic portable controller regression; real business judging and event
// scheduling, with browser rendering replaced by an empty DOM and posture stub.
let Controller: any, current: any, foldable: any;
beforeAll(async () => {
  vi.stubGlobal('window', { addEventListener: vi.fn(), __SIM__: { getState: () => current },
    __OS__: { getState: () => ({ activeAppId: 'wechat' }), getAppRoute: () => ({ path: '/' }) },
    __FOLDAGENT__: { getState: () => foldable, setPosture: (posture: string) => {
      foldable = { ...foldable, posture, layout_id: posture === 'folded' ? 'cover_single' : 'inner_wide' };
    } } });
  vi.stubGlobal('document', { querySelector: () => null, querySelectorAll: () => [], activeElement: null });
  vi.stubGlobal('requestAnimationFrame', (callback: (time: number) => void) => { callback(0); return 0; });
  for (const name of ['HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLSelectElement']) vi.stubGlobal(name, class {});
  Controller = (await import('../foldagent_benchmark')).FoldAgentBenchmarkController;
});
beforeEach(() => {
  current = { apps: { source: { records: ['Alpha'] },
    wechat: { chats: [], chatDrafts: { target: 'Hello, ' }, sendCount: 0 } } };
  foldable = { posture: 'unfolded', layout_id: 'inner_wide', multi_window: { mode: 'fullscreen' } };
});
const action = (id: string, extra = {}) => ({ id, valid: true, terminal: false, ...extra });
function harness() {
  const controller: any = new Controller();
  const event = (id: string, from: string, to: string) => ({ event_id: id, controller: 'benchmark',
    trigger: { all: [{ path: 'benchmark.anchors.unit.ready', equals: true }], max_wait_steps: 20 },
    transition: { from_posture: from, to_posture: to, duration_steps: 1 } });
  controller.task = { id: 'unit-workflow-events', pair_id: 'unit', apps: ['source', 'wechat'],
    seed_contract: { workflow_v1: { version: 1, card: 'unit',
      source: { app: 'source', selector: '[data-source]', facts: [['Alpha']] },
      target: { app: 'wechat', kind: 'wechat', id: 'target', prefix: 'Hello, ', facts: [['Alpha']], route: '^/', field: 'input' },
      protected_paths: ['apps.source.records'] } },
    event_plan: [event('first', 'unfolded', 'folded'), event('second', 'folded', 'unfolded')],
    evaluator: { success_all: [{ path: 'workflow.business_passed', op: 'eq', value: true }], safety_all: [],
      must_have_events: ['first', 'second'], require_post_transition_action: true,
      max_invalid_actions: 3, max_repeated_actions: 3 } };
  controller.initialState = structuredClone(current);
  return controller;
}
async function firstEvent() {
  const controller = harness();
  await controller.recordAgentAction(action('source.open'));
  expect(controller.getReport().fired_events).toEqual([]);
  controller.anchors.ready = true;
  await controller.recordAgentAction(action('chat.open'));
  // Both predicates are true, but one action must still fire only one event.
  expect(controller.getReport().evidence.map((event: any) => [event.event_id, event.trigger_step])).toEqual([['first', 2]]);
  expect(foldable.posture).toBe('folded');
  return controller;
}

describe('Workflow posture events on adjacent agent steps', () => {
  it('fires at steps 2 and 3 and accepts business completion after the second event', async () => {
    const controller = await firstEvent();
    await controller.recordAgentAction(action('chat.draft.focus'));
    const afterSecond = controller.getReport();
    expect(afterSecond.evidence.map((event: any) => [event.event_id, event.trigger_step])).toEqual([['first', 2], ['second', 3]]);
    expect(foldable.posture).toBe('unfolded');
    expect(afterSecond.post_transition_by_event.second).toBe(false);
    expect(afterSecond.passed).toBe(false);
    current.apps.wechat.chatDrafts.target += 'Alpha';
    await controller.recordAgentAction(action('chat.draft.input'));
    expect(controller.getReport()).toMatchObject({ passed: true, event_coverage: true,
      post_transition_by_event: { first: true, second: true } });
  });

  it.each([
    action('agent.wait'), action('agent.terminate', { terminal: true }),
    action('agent.invalid', { valid: false }), action('dom.click', { valid: false }), action('fold'),
  ])('does not trigger the next event from $id (valid=$valid)', async blocked => {
    const controller = await firstEvent();
    await controller.recordAgentAction(blocked);
    expect(controller.getReport().fired_events).toEqual(['first']);
  });

  it('still blocks events after business completion', async () => {
    const controller = await firstEvent();
    current.apps.wechat.chatDrafts.target += 'Alpha';
    await controller.recordAgentAction(action('chat.draft.input'));
    expect(controller.getReport()).toMatchObject({ business_judgment: { business_passed: true },
      fired_events: ['first'], event_coverage: false, passed: false });
  });

  it('still requires the next trigger predicate and expected starting posture', async () => {
    const controller = await firstEvent();
    controller.anchors.ready = false;
    await controller.recordAgentAction(action('chat.draft.focus'));
    expect(controller.getReport().fired_events).toEqual(['first']);
    controller.anchors.ready = true;
    foldable = { ...foldable, posture: 'unfolded', layout_id: 'inner_wide' };
    await controller.recordAgentAction(action('chat.draft.focus'));
    expect(controller.getReport().fired_events).toEqual(['first']);
  });
});
