import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

// Synthetic public menu diagnostic. Not a formal CW06/CW21 instance or agent run.
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const app = '[data-app-id="meituan_waimai"]';
const shop = { id: 'rice', name: '来源滚动诊断店', categoryId: 'food', category: '美食',
  rating: '4.8', sales: '月售 100+', time: '约 20 分钟', dishes: Array.from({ length: 20 }, (_, i) => ({
    id: `dish-${i}`, name: `菜单菜品 ${i + 1}`, price: 10 + i, note: '公开合成菜单', emoji: '🍱',
  })) };
const makeTask = (posture, preEvent = false, dishes = ['dish-0', 'dish-19']) => ({
  id: 'DIAG-MENU-FACTS', pair_id: 'DIAG_MENU_FACTS', apps: ['meituan_waimai'],
  seed_contract: { shop_id: 'rice', dish_ids: dishes },
  initial_window: { posture, layout: posture === 'folded' ? 'cover_single' : posture === 'tabletop' ? 'inner_book' : 'inner_wide', focused_app: 'meituan_waimai', mode: 'fullscreen' },
  event_plan: preEvent ? [{ event_id: 'source.pre', controller: 'benchmark',
    trigger: { all: [
      { path: 'benchmark.anchors.DIAG_MENU_FACTS.source_opened', equals: true },
      { path: 'benchmark.anchors.DIAG_MENU_FACTS.source_facts_verified', equals: false },
    ], max_wait_steps: 30 },
    transition: { from_posture: 'unfolded', to_posture: 'folded', duration_steps: 1 } }] : [],
  evaluator: { success_all: [], safety_all: [], must_have_events: preEvent ? ['source.pre'] : [],
    require_post_transition_action: false, max_invalid_actions: 0, max_repeated_actions: 100 }, recovery: null,
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto('http://127.0.0.1:3100/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__FOLDAGENT_BENCH__));
  const start = async task => {
    await page.evaluate(({ task, shop }) => window.__FOLDAGENT_BENCH__.start(task, {
      automatic: false, seedState: { raw_apps: { meituan_waimai: { shops: { rice: shop },
        cart: { shopId: 'rice', quantities: {} } } } },
    }), { task, shop });
    await page.waitForSelector(`${app} .mt-shop-card`);
  };
  const record = id => page.evaluate(id => window.__FOLDAGENT_BENCH__.recordAgentAction({ id, kind: 'interaction', params: {} }), id);
  const report = () => page.evaluate(() => window.__FOLDAGENT_BENCH__.getReport());
  const anchors = r => r.final_state.benchmark.anchors.DIAG_MENU_FACTS;
  const openMenu = async () => {
    await page.click(`${app} .mt-shop-card[data-trigger-params='{"id":"rice"}']`);
    await page.waitForSelector(`${app} .mt-dish`);
    assert.equal(await page.$$eval(`${app} [data-benchmark-dish-id]`, nodes => nodes.length), 20, 'Diagnostic menu injection must actually apply');
    await record('diag.open-menu');
  };
  const scrollMenu = async () => {
    const rect = await page.$eval(`${app} [data-scroll-container="menu"]`, el => {
      const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.mouse.move(rect.x, rect.y);
    for (let i = 0; i < 60; i++) {
      await page.mouse.wheel({ deltaY: 120 });
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 80)));
      await record('diag.menu-wheel');
      if (anchors(await report()).source_facts_verified) return;
    }
    const geometry = await page.$$eval(`${app} [data-benchmark-dish-id]`, nodes => nodes.filter(n => ['dish-0', 'dish-19'].includes(n.dataset.benchmarkDishId)).map(n => ({
      id: n.dataset.benchmarkDishId, fields: [...n.querySelectorAll('[data-benchmark-menu-name],[data-benchmark-menu-price]')].map(f => {
        const r = f.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + 1, r.top + 1);
        return { text: f.textContent, rect: r.toJSON(), hit: hit?.outerHTML.slice(0, 160) };
      }),
    })));
    assert.fail(`Scrolling to the complete target texts must establish menu delivery: ${JSON.stringify(geometry)}`);
  };
  const postures = [];
  for (const posture of ['folded', 'unfolded', 'tabletop']) {
    await start(makeTask(posture));
    await record('diag.home');
    assert.equal(anchors(await report()).source_facts_verified, false);
    await page.click(`${app} .mt-shop-card[data-trigger-params='{"id":"tea"}']`);
    await page.waitForSelector(`${app} .mt-dish`);
    await record('diag.wrong-shop');
    assert.equal(anchors(await report()).source_facts_verified, false);
    await page.click(`${app} .mt-header [data-trigger="meituan.home.open"]`);
    await page.waitForSelector(`${app} .mt-shop-card`);
    await openMenu();
    const before = await report();
    assert.equal(anchors(before).source_opened, true);
    assert.equal(anchors(before).source_facts_verified, false, 'Offscreen DOM is not delivered facts');
    await scrollMenu();
    const after = await report();
    assert.equal(anchors(after).source_facts_verified, true);
    assert.deepEqual(after.final_state.apps.meituan_waimai.cart.quantities, {});
    assert.equal(after.final_state.apps.meituan_waimai.user.orderIds.length, 0);
    postures.push(posture);
  }
  // A pre event is naturally reachable when a required fact lies below the fold.
  await start(makeTask('unfolded', true));
  await openMenu();
  let result = await report();
  assert.deepEqual(result.fired_events, ['source.pre']);
  assert.equal(anchors(result).source_facts_verified, false, 'New episode clears accumulated delivery');
  await scrollMenu();
  assert.equal(anchors(await report()).source_facts_verified, true);
  // If all facts fit on the first screen, do not invent a separate pre phase.
  await start(makeTask('unfolded', false, ['dish-0']));
  await openMenu();
  assert.equal(anchors(await report()).source_facts_verified, true);
  // Rendered text alone is insufficient when the price is hidden/occluded.
  await start(makeTask('unfolded', false, ['dish-0']));
  await page.click(`${app} .mt-shop-card[data-trigger-params='{"id":"rice"}']`);
  await page.waitForSelector(`${app} [data-benchmark-menu-price]`);
  await page.$eval(`${app} [data-benchmark-menu-price]`, el => { el.style.visibility = 'hidden'; });
  await record('diag.hidden-price');
  assert.equal(anchors(await report()).source_facts_verified, false);
  await page.$eval(`${app} [data-benchmark-menu-price]`, el => {
    el.style.visibility = '';
    const r = el.getBoundingClientRect();
    const blocker = document.createElement('div'); blocker.id = 'diag-price-blocker';
    Object.assign(blocker.style, { position: 'fixed', left: `${r.left}px`, top: `${r.top}px`,
      width: `${r.width}px`, height: `${r.height}px`, background: 'white', zIndex: '2147483647' });
    document.body.append(blocker);
  });
  await record('diag.covered-price');
  assert.equal(anchors(await report()).source_facts_verified, false);
  await page.evaluate(() => document.querySelector('#diag-price-blocker').remove());
  await page.$eval(`${app} [data-benchmark-dish-id="dish-0"]`, el => { el.style.opacity = '0'; });
  await record('diag.transparent-parent');
  assert.equal(anchors(await report()).source_facts_verified, false);
  await page.$eval(`${app} [data-benchmark-dish-id="dish-0"]`, el => { el.style.opacity = ''; });
  await record('diag.uncovered-price');
  assert.equal(anchors(await report()).source_facts_verified, true);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, postures, wrongShopRejected: true, offscreenRejected: true,
    accumulatedAfterOrdinaryWheel: true, freshEpisode: true, naturalPreEvent: true,
    firstScreenCanVerifyImmediately: true, hiddenAndCoveredPriceRejected: true, transparentParentRejected: true,
    pageErrors: 0, scope: 'Menu delivery diagnostic, not reading proof or formal task acceptance' }));
} finally { await browser.close(); }
