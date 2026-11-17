import assert from 'node:assert/strict';
import path from 'node:path';
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto('http://127.0.0.1:3100/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__OS__?.locale && window.__SIM__));
  const app = '[data-app-id="meituan_waimai"]';
  const open = async route => {
    await page.evaluate(route => window.__OS__.openApp('meituan_waimai', route), route);
    await page.waitForFunction(route => window.__OS__.getAppRoute('meituan_waimai')?.path === route, {}, route);
    await page.waitForSelector(app, { visible: true });
  };
  const snapshot = () => page.evaluate(() => window.__SIM__.getState().apps.meituan_waimai);
  await open('/shop/rice');
  await page.evaluate(() => window.__SIM__.setState({ apps: { meituan_waimai: { shops: { rice: {
    id: 'rice', name: '公开语言测试店', rating: '4.8', sales: '月售 100+', categoryId: 'food', category: '美食', time: '约 25 分钟',
    dishes: [{ id: 'chicken', name: '公开测试菜品', price: 12.35, note: '仅用于测试', emoji: '🍱' }],
  } } } } }, { deep: false, reload: false }));
  await page.waitForFunction(app => document.querySelector(`${app} [data-benchmark-menu-price]`)?.textContent === '¥12.35', {}, app);
  await page.waitForSelector(`${app} [data-action="meituan.cart.item.add"]`);
  await page.click(`${app} [data-action="meituan.cart.item.add"][data-action-params='{"itemId":"chicken"}']`);
  await open('/cart');
  await page.click(`${app} [data-trigger="meituan.checkout.open"]`);
  await page.waitForFunction(() => window.__OS__.getAppRoute('meituan_waimai')?.path === '/order');
  await open('/shop/rice');
  await page.waitForSelector(`${app} [data-action="meituan.cart.item.add"]`);
  await page.click(`${app} [data-action="meituan.cart.item.add"][data-action-params='{"itemId":"chicken"}']`);
  const initial = await snapshot();
  assert.equal(initial.cart.quantities.chicken, 1);
  assert.equal(initial.user.orderIds.length, 1);
  assert.equal(initial.orders[initial.user.orderIds[0]].status, 'simulated');
  assert.equal(initial.orders[initial.user.orderIds[0]].total, 12.35);
  const labels = {
    en: { search: 'Search shops and items', home: 'Home', food: 'Food', drinks: 'Desserts & drinks', nearby: 'Nearby shops',
      hero: 'What would you like?', picks: 'Popular picks', cart: 'Cart', clear: 'Clear', reviews: 'Customer reviews',
      merchant: 'Merchant information', orders: 'Demo orders', profile: 'Me', unavailable: 'Shop unavailable' },
    'zh-Hans': { search: '搜索商家、商品', home: '首页', food: '美食', drinks: '甜点饮品', nearby: '附近好店',
      hero: '想吃什么，', picks: '热销推荐', cart: '购物车', clear: '清空', reviews: '顾客评价',
      merchant: '商家信息', orders: '模拟订单', profile: '我的', unavailable: '店铺暂不可用' },
  };
  const rows = [];
  const checkLayout = async () => {
    const issues = await page.$eval(app, node => {
      const outer = node.getBoundingClientRect();
      return [...node.querySelectorAll('button,input')].filter(control => {
        const rect = control.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && (rect.left < outer.left - 1 || rect.right > outer.right + 1);
      }).map(control => control.getAttribute('aria-label') || control.textContent.trim());
    });
    assert.deepEqual(issues, [], 'Localized controls must remain within the app width');
  };
  for (const posture of ['folded', 'unfolded', 'half_folded']) {
    await page.evaluate(posture => window.__FOLDAGENT__.setPosture(posture), posture);
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 400)));
    for (const locale of ['en', 'zh-Hans']) {
      const t = labels[locale];
      await page.evaluate(locale => window.__OS__.locale.setLocale(locale), locale);
      await open('/');
      await page.waitForFunction(({ app, text }) => document.querySelector(`${app} .mt-search input`)?.placeholder === text,
        {}, { app, text: t.search });
      const home = await page.$eval(`${app} .mt-main`, node => node.innerText);
      for (const text of [t.hero, t.home, t.food, t.drinks, t.nearby]) assert.ok(home.includes(text));
      if (locale === 'en') for (const old of ['当前地址', '新客专享', '附近好店', '热销推荐']) assert.ok(!home.includes(old));
      await checkLayout();
      await open('/shop/rice');
      await page.waitForFunction(({ app, text }) => document.querySelector(`${app} .mt-main h2`)?.textContent === text,
        {}, { app, text: t.picks });
      const dish = await page.$eval(`${app} [data-benchmark-dish-id="chicken"]`, node => ({
        name: node.querySelector('[data-benchmark-menu-name]').textContent,
        price: node.querySelector('[data-benchmark-menu-price]').textContent,
      }));
      assert.equal(dish.name, initial.cart_summary.items[0].name);
      assert.equal(dish.price, `¥${(initial.cart_summary.items[0].unitPriceCents / 100).toFixed(2)}`);
      if (locale === 'en') assert.ok(await page.$eval(`${app} .mt-cartbar small`, node => node.textContent.includes('1 item') && !node.textContent.includes('1 items')));
      await checkLayout();
      if (posture === 'folded' && locale === 'en' && process.argv[2]) {
        await page.screenshot({ path: path.resolve(process.argv[2], 'mobilegym_overlay/meituan_en_folded.png') });
      }
      for (const [route, selector, text] of [
        ['/cart', '.mt-header b', t.cart], ['/shop/rice/reviews', '.mt-shop-panel h2', t.reviews],
        ['/shop/rice/info', '.mt-shop-panel h2', t.merchant], ['/orders', '.mt-header b', t.orders],
        ['/me', '.mt-header b', t.profile], ['/shop/missing-localization', '.mt-header b', t.unavailable],
      ]) {
        await open(route);
        await page.waitForFunction(({ app, selector, text }) => document.querySelector(`${app} ${selector}`)?.textContent === text,
          {}, { app, selector, text });
        if (route === '/cart') assert.equal(await page.$eval(`${app} .mt-cart-title button`, node => node.textContent), t.clear);
        if (route === '/orders') {
          assert.equal(await page.$eval(`${app} .mt-order-card strong`, node => node.textContent), '¥12.35');
          if (locale === 'en') assert.equal(await page.$eval(`${app} .mt-order-card span`, node => node.textContent), '1 item');
        }
        await checkLayout();
      }
      assert.deepEqual(await snapshot(), initial, 'Switching interface language/routes must not change the menu, cart or orders');
      rows.push({ posture, locale, routesChecked: 8, sourceAndCartUnchanged: true, horizontalClipping: false });
    }
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, rows, pageErrors: errors,
    scope: 'Meituan chrome localization UI regression; not bilingual task/model qualification' }));
} finally { await browser.close(); }
