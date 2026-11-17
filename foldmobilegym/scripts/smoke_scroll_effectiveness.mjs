import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto('http://127.0.0.1:3100/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__FOLDAGENT_BENCH__));
  const shop = { id: 'scroll-test', name: '公开滚动诊断店', rating: '4.8', sales: '100', categoryId: 'food',
    category: '美食', time: '20分钟', dishes: Array.from({ length: 30 }, (_, i) => ({
      id: `dish-${i}`, name: `公开菜品 ${i}`, price: 10, note: '合成诊断', emoji: '🍱' })) };
  const task = { id: 'DIAG-SCROLL', pair_id: 'DIAG_SCROLL', apps: ['meituan_waimai'], seed_contract: {},
    initial_window: { posture: 'unfolded', layout: 'inner_wide', focused_app: 'meituan_waimai', mode: 'fullscreen' },
    event_plan: [], evaluator: { success_all: [], safety_all: [], must_have_events: [],
      require_post_transition_action: false, max_invalid_actions: 0, max_repeated_actions: 1 } };
  await page.evaluate(({ task, shop }) => window.__FOLDAGENT_BENCH__.start(task, {
    automatic: false, seedState: { raw_apps: { meituan_waimai: { shops: { [shop.id]: shop } } } },
  }), { task, shop });
  await page.waitForSelector('[data-app-id="meituan_waimai"] .mt-shop-card');
  await page.click('[data-app-id="meituan_waimai"] .mt-shop-card[data-trigger-params=\'{"id":"scroll-test"}\']');
  const record = () => page.evaluate(() => window.__FOLDAGENT_BENCH__.recordAgentAction({ id: 'ui.scroll', kind: 'interaction', params: { direction: 'down' } }));
  await page.waitForSelector('[data-app-id="meituan_waimai"] [data-scroll-container="menu"]');
  await record();
  const rect = await page.$eval('[data-app-id="meituan_waimai"] [data-scroll-container="menu"]', el => {
    const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.move(rect.x, rect.y);
  for (let i = 0; i < 2; i++) {
    await page.mouse.wheel({ deltaY: 100 });
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));
    await record();
  }
  let report = await page.evaluate(() => window.__FOLDAGENT_BENCH__.getReport());
  assert.equal(report.repeated_actions, 0, 'Effective same-direction scrolls are not repeats');
  assert.ok(report.action_trace.slice(-2).every(action => action.effectful));
  // Diagnostic setup only: place the container at its boundary, then actual
  // wheel input must leave the viewport unchanged and be classified no-op.
  await page.$eval('[data-app-id="meituan_waimai"] [data-scroll-container="menu"]', el => { el.scrollTop = el.scrollHeight; });
  await record();
  await page.mouse.wheel({ deltaY: 100 });
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));
  await record();
  report = await page.evaluate(() => window.__FOLDAGENT_BENCH__.getReport());
  assert.equal(report.action_trace.at(-1).effectful, false);
  assert.equal(report.repeated_actions, 1, 'Boundary wheel remains a repeated no-op');
  // Hidden DOM cannot give an unrelated repeated action apparent progress.
  await page.evaluate(() => {
    const hidden = document.createElement('div'); hidden.id = 'diag-hidden-scroll';
    hidden.dataset.scrollContainer = 'hidden-diagnostic';
    Object.assign(hidden.style, { position: 'fixed', width: '100px', height: '10px', overflow: 'scroll', visibility: 'hidden' });
    const content = document.createElement('div'); content.style.height = '1000px'; hidden.append(content); document.body.append(hidden);
    hidden.scrollTop = 100;
  });
  await record();
  report = await page.evaluate(() => window.__FOLDAGENT_BENCH__.getReport());
  assert.equal(report.action_trace.at(-1).effectful, false);
  assert.equal(report.repeated_actions, 2);
  console.log(JSON.stringify({ passed: true, effectiveScrollsNotRepeated: true, boundaryNoopDetected: true,
    hiddenScrollIgnored: true, scope: 'Controller interaction-effect diagnostic, not agent evaluation' }));
} finally { await browser.close(); }
