import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';

// Controller integration diagnostic, not a schema-valid task/model episode.
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const app = '[data-app-id="meituan_waimai"]';
const recoveryTest = process.argv.includes('--recovery');
const wrongItemTest = process.argv.includes('--wrong-item');
const output = process.argv.find(arg => arg.startsWith('--output='))?.slice('--output='.length);
if (output) fs.mkdirSync(output, { recursive: true });
const protocols = recoveryTest ? [
  { from: 'unfolded', to: 'folded', layout: 'inner_wide', name: 'inner_to_cover' },
  { from: 'folded', to: 'unfolded', layout: 'cover_single', name: 'cover_to_inner' },
  { from: 'tabletop', to: 'folded', layout: 'inner_book', name: 'tabletop_to_cover' },
  { from: 'folded', to: 'tabletop', layout: 'cover_single', name: 'cover_to_tabletop' },
] : [{ from: 'unfolded', to: 'folded', layout: 'inner_wide', name: 'inner_to_cover' }];
try {
  for (const protocol of protocols) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto('http://127.0.0.1:3100/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__FOLDAGENT_BENCH__));
  await page.evaluate(p => window.__FOLDAGENT__.setPosture(p === 'tabletop' ? 'half_folded' : p), protocol.from);
  const task = {
    id: 'DIAG-CART-ENTRY', pair_id: 'DIAG_CART_ENTRY', apps: ['meituan_waimai'], seed_contract: {},
    initial_window: { posture: protocol.from, layout: protocol.layout, focused_app: 'meituan_waimai', mode: 'fullscreen' },
    event_plan: [{ event_id: 'cart.entry.fold', controller: 'benchmark',
      trigger: { all: [{ path: 'benchmark.anchors.DIAG_CART_ENTRY.target_entry_started', equals: true }], max_wait_steps: 10 },
      transition: { from_posture: protocol.from, to_posture: protocol.to, duration_steps: 1 },
      ...(recoveryTest ? { fault: { type: 'recreate_app', app_id: 'meituan_waimai', preserve_persisted_state: true } } : {}) }],
    evaluator: { success_all: [
      { path: 'apps.meituan_waimai.cart.shopId', op: 'eq', value: 'rice' },
      { path: 'apps.meituan_waimai.cart.quantities', op: 'eq', value: { chicken: 2 } },
    ], safety_all: [{ path: 'apps.meituan_waimai.user.orderIds', op: 'unchanged', value: null }], must_have_events: ['cart.entry.fold'],
      require_post_transition_action: true, max_invalid_actions: 0, max_repeated_actions: 1 },
    recovery: recoveryTest ? { app_id: 'meituan_waimai', required_context: ['cart.shopId', 'cart.quantities'],
      max_recovery_steps: 10, no_duplicate_commit: true, capture_strategy: 'persisted_plus_visible_form_hash', completion_condition: 'success_all' } : null,
  };
  await page.evaluate(t => window.__FOLDAGENT_BENCH__.start(t, { automatic: false }), task);
  await page.evaluate(() => window.__OS__.openApp('meituan_waimai'));
  await page.waitForSelector(`${app} .mt-shop-card`);
  await page.click(`${app} .mt-shop-card[data-trigger-params='{"id":"rice"}']`);
  await page.waitForSelector(`${app} .mt-dish`);
  await page.evaluate(() => window.__FOLDAGENT_BENCH__.recordAgentAction({ id: 'diag.open-shop', kind: 'transition', params: {} }));
  const opened = await page.evaluate(() => window.__FOLDAGENT_BENCH__.getReport());
  assert.equal(opened.final_state.benchmark.anchors.DIAG_CART_ENTRY.target_entry_started, false);
  assert.equal(opened.fired_events.length, 0);
  const add = `${app} [data-action="meituan.cart.item.add"][data-action-params='{"itemId":"chicken"}']`;
  await page.click(add);
  await page.evaluate(() => window.__FOLDAGENT_BENCH__.recordAgentAction({ id: 'diag.add-first', kind: 'action', params: {} }));
  const entered = await page.evaluate(() => window.__FOLDAGENT_BENCH__.getReport());
  assert.deepEqual(entered.fired_events, ['cart.entry.fold']);
  assert.equal(entered.evidence[0].trigger_step, 2);
  const devicePosture = p => p === 'tabletop' ? 'half_folded' : p;
  assert.equal(entered.evidence[0].posture_before, devicePosture(protocol.from));
  assert.equal(entered.evidence[0].posture_after, devicePosture(protocol.to));
  assert.notEqual(entered.evidence[0].layout_before, entered.evidence[0].layout_after);
  assert.equal(entered.final_state.apps.meituan_waimai.cart.quantities.chicken, 1);
  if (recoveryTest) {
    assert.equal(entered.evidence[0].context_retained, true);
    assert.ok(entered.evidence[0].context_checks.every(check => check.passed));
  }
  await page.waitForSelector(add);
  const nextItem = wrongItemTest ? `${app} [data-action="meituan.cart.item.add"][data-action-params='{"itemId":"beef"}']` : add;
  await page.click(nextItem);
  await page.evaluate(() => window.__FOLDAGENT_BENCH__.recordAgentAction({ id: 'diag.add-second', kind: 'action', params: {} }));
  const final = await page.evaluate(() => window.__FOLDAGENT_BENCH__.getReport());
  assert.equal(final.post_transition_by_event['cart.entry.fold'], true);
  assert.deepEqual(final.final_state.apps.meituan_waimai.cart.quantities,
    wrongItemTest ? { chicken: 1, beef: 1 } : { chicken: 2 });
  assert.equal(final.final_state.apps.meituan_waimai.user.orderIds.length, 0);
  assert.equal(final.passed, !wrongItemTest);
  if (recoveryTest) {
    assert.equal(final.recovery.context_retained, true);
    if (!wrongItemTest) assert.equal(final.recovery.passed, true);
  }
  if (output) fs.writeFileSync(path.join(output, `${protocol.name}.${wrongItemTest ? 'wrong-item' : 'positive'}.report.json`), JSON.stringify(final, null, 2));
  console.log(JSON.stringify({ expectationMet: true, goalPassed: final.passed, openingDoesNotTrigger: true,
    firstAdditionTriggers: true, postTransitionAdditionRetained: true, noCheckout: true,
    protocol: protocol.name, controllerRecreate: recoveryTest, wrongItemRejected: wrongItemTest }));
  await context.close();
  }
} finally { await browser.close(); }
