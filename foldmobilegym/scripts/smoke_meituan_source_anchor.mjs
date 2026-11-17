import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const app = '[data-app-id="meituan_waimai"]';
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto('http://127.0.0.1:3100/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__FOLDAGENT_BENCH__));
  const task = { id: 'DIAG-CART-SOURCE', pair_id: 'DIAG_CART_SOURCE',
    apps: ['meituan_waimai'], seed_contract: { shop_id: 'rice' },
    initial_window: { posture: 'unfolded', layout: 'inner_wide', focused_app: 'meituan_waimai', mode: 'fullscreen' },
    event_plan: [{ event_id: 'source.fold', controller: 'benchmark',
      trigger: { all: [
        { path: 'benchmark.anchors.DIAG_CART_SOURCE.source_opened', equals: true },
        { path: 'benchmark.anchors.DIAG_CART_SOURCE.source_facts_verified', equals: false },
      ], max_wait_steps: 10 },
      transition: { from_posture: 'unfolded', to_posture: 'folded', duration_steps: 1 } }],
    evaluator: { success_all: [], safety_all: [], must_have_events: ['source.fold'],
      require_post_transition_action: true, max_invalid_actions: 0, max_repeated_actions: 1 }, recovery: null };
  await page.evaluate(t => window.__FOLDAGENT_BENCH__.start(t, { automatic: false }), task);
  const record = id => page.evaluate(id => window.__FOLDAGENT_BENCH__.recordAgentAction({ id, kind: 'transition', params: {} }), id);
  await page.evaluate(() => window.__OS__.openApp('meituan_waimai'));
  await page.waitForSelector(`${app} .mt-shop-card`);
  await record('diag.home');
  let report = await page.evaluate(() => window.__FOLDAGENT_BENCH__.getReport());
  assert.equal(report.final_state.benchmark.anchors.DIAG_CART_SOURCE.source_opened, false, 'Home is not the requested store');
  assert.equal(report.fired_events.length, 0);
  await page.click(`${app} .mt-shop-card[data-trigger-params='{"id":"tea"}']`);
  await page.waitForSelector(`${app} .mt-dish`);
  await record('diag.wrong-shop');
  report = await page.evaluate(() => window.__FOLDAGENT_BENCH__.getReport());
  assert.equal(report.final_state.benchmark.anchors.DIAG_CART_SOURCE.source_opened, false, 'Wrong store is not a valid source');
  assert.equal(report.fired_events.length, 0);
  await page.click(`${app} .mt-header [data-trigger="system.back"]`);
  await page.waitForSelector(`${app} .mt-shop-card`);
  await page.click(`${app} .mt-shop-card[data-trigger-params='{"id":"rice"}']`);
  await page.waitForSelector(`${app} .mt-dish`);
  await record('diag.correct-shop');
  report = await page.evaluate(() => window.__FOLDAGENT_BENCH__.getReport());
  assert.deepEqual(report.fired_events, ['source.fold']);
  assert.equal(report.evidence[0].trigger_step, 3);
  assert.equal(report.final_state.benchmark.anchors.DIAG_CART_SOURCE.source_facts_verified, false);
  await page.click(`${app} [data-action="meituan.cart.item.add"][data-action-params='{"itemId":"chicken"}']`);
  await record('diag.post-source-add');
  report = await page.evaluate(() => window.__FOLDAGENT_BENCH__.getReport());
  assert.equal(report.post_transition_by_event['source.fold'], true);
  console.log(JSON.stringify({ passed: true, homeRejected: true, wrongShopRejected: true,
    correctSourceTriggers: true, openingDoesNotVerifyFacts: true, scope: 'Controller diagnostic, not CW06 task acceptance' }));
} finally { await browser.close(); }
