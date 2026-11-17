import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

// Public synthetic source world only; no injected task completion or scroll state.
const shops = Object.fromEntries(Array.from({ length: 16 }, (_, index) => {
  const id = `touch-shop-${String(index).padStart(2, '0')}`;
  return [id, { id, name: `公开触摸测试店 ${index + 1}`, rating: '4.8', sales: '公开合成数据',
    category: '美食', categoryId: 'food', time: '模拟配送时间',
    dishes: Array.from({ length: 24 }, (_, dish) => ({ id: `dish-${dish}`, name: `公开测试菜品 ${dish + 1}`,
      price: 12.35 + dish, note: '仅用于滚动诊断', emoji: '🍱' })) }];
}));
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1100, hasTouch: true });
  const cdp = await page.createCDPSession();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:3100/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__SIM__ && window.__OS__?.keyboard));
  await page.evaluate(shops => {
    const state = window.__SIM__.getState();
    window.__SIM__.setState({ apps: { meituan_waimai: { ...state.apps.meituan_waimai, shops } } });
  }, shops);
  const app = '[data-app-id="meituan_waimai"]';
  const field = `${app} .mt-search input`;
  const main = `${app} .mt-main`;
  const rows = [];
  const initial = await page.evaluate(() => window.__SIM__.getState().apps.meituan_waimai);
  for (const posture of ['folded', 'unfolded', 'half_folded']) {
    await page.evaluate(posture => window.__FOLDAGENT__.setPosture(posture), posture);
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 400)));
    for (const scenario of ['search_keyboard', 'search_no_keyboard', 'menu_add_button']) for (const direction of ['up', 'down']) {
      const menu = scenario === 'menu_add_button';
      await page.evaluate(menu => window.__OS__.openApp('meituan_waimai', menu ? '/shop/touch-shop-00' : '/'), menu);
      await page.waitForSelector(menu ? `${app} .mt-menu-tabs` : field, { visible: true });
      if (menu) assert.equal(await page.$eval(`${app} [data-benchmark-shop-id]`,
        node => node.dataset.benchmarkShopId), 'touch-shop-00');
      if (!menu) {
        await page.click(field);
        await page.type(field, '公开触摸');
        await page.waitForFunction(field => document.querySelector(field)?.value === '公开触摸', {}, field);
        if (scenario === 'search_no_keyboard') await page.click(`${app} .mt-location b`);
      }
      const expectedKeyboard = scenario === 'search_keyboard';
      await page.waitForFunction(expected => window.__OS__.keyboard.isVisible() === expected, {}, expectedKeyboard);
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 400)));
      const bounds = await (await page.$(main)).boundingBox();
      await page.mouse.move(bounds.x + 20, bounds.y + 30);
      // Existing app entries can retain scroll position. Normalize with real
      // wheel input, never by assigning scrollTop or injecting an end state.
      await page.mouse.wheel({ deltaY: -10000 });
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 200)));
      assert.ok(await page.$eval(main, node => node.scrollTop < 2), 'Wheel setup must reach the top');
      await page.mouse.wheel({ deltaY: 450 });
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 200)));
      const start = await page.evaluate(({ main, target, direction }) => {
        const scroller = document.querySelector(main);
        const view = scroller.getBoundingClientRect();
        for (const node of document.querySelectorAll(target)) {
          if (node.disabled) continue; // A disabled Add button is not a useful accidental-click test.
          const rect = node.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = direction === 'up' ? Math.min(rect.bottom - 2, view.bottom - 10)
            : Math.max(rect.top + 2, view.top + 10);
          if (y < rect.top || y > rect.bottom) continue;
          const endY = direction === 'up' ? Math.max(view.top + 10, y - 100)
            : Math.min(view.bottom - 10, y + 100);
          if (Math.abs(endY - y) < 40) continue;
          if (!node.contains(document.elementFromPoint(x, y))) continue;
          return { x, y, endY, top: scroller.scrollTop,
            max: scroller.scrollHeight - scroller.clientHeight };
        }
        return null;
      }, { main, direction, target: menu ? `${app} .mt-dish-controls button` : `${app} .mt-shop-card` });
      assert.ok(start && Math.abs(start.y - start.endY) >= 40, 'Swipe must start on an exposed interactive control');
      assert.ok((direction === 'up' ? start.max - start.top : start.top) > 100, 'Actual list must have room to scroll');
      await page.evaluate(app => {
        window.__scrollClicks = [];
        window.__scrollClickListener = event => {
          if (event.target.closest?.(app)) window.__scrollClicks.push(event.target.tagName);
        };
        document.addEventListener('click', window.__scrollClickListener, true);
      }, app);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start.x, y: start.y, id: 1 }] });
      for (let step = 1; step <= 8; step++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{
          x: start.x, y: start.y + (start.endY - start.y) * step / 8, id: 1 }] });
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 25)));
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 400)));
      const outcome = await page.evaluate(({ main, field, app, menu }) => ({
        top: document.querySelector(main)?.scrollTop, keyboard: window.__OS__.keyboard.isVisible(),
        query: document.querySelector(field)?.value,
        routeIntact: Boolean(document.querySelector(menu ? `${app} .mt-menu-tabs` : field)),
        clicks: window.__scrollClicks,
      }), { main, field, app, menu });
      await page.evaluate(() => {
        document.removeEventListener('click', window.__scrollClickListener, true);
        delete window.__scrollClicks; delete window.__scrollClickListener;
      });
      console.log(JSON.stringify({ posture, scenario, direction, start, outcome }));
      const actualScrollDelta = outcome.top - start.top;
      assert.ok((direction === 'up' ? actualScrollDelta : -actualScrollDelta) >= 20,
        'Native touch swipe must actually scroll in the expected direction');
      assert.ok(outcome.routeIntact, 'Swipe must not navigate');
      assert.equal(outcome.keyboard, expectedKeyboard);
      assert.deepEqual(outcome.clicks, [], 'Swipe must not become a click');
      if (!menu) assert.equal(outcome.query, '公开触摸');
      assert.deepEqual(await page.evaluate(() => window.__SIM__.getState().apps.meituan_waimai), initial);
      rows.push({ posture, scenario, direction, actualScrollDelta, noClick: true, sourceUnchanged: true });
    }
  }
  assert.equal(rows.length, 18);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, rows, pageErrors: errors,
    scope: 'Public synthetic browser touch-scroll regression; not physical devices, model trajectories or fold/recovery qualification' }));
} finally { await browser.close(); }
