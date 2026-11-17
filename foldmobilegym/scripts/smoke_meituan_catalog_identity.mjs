import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto('http://127.0.0.1:3100/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__SIM__ && window.__OS__));
  await page.evaluate(() => window.__SIM__.resetState());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__SIM__ && window.__OS__));
  const app = '[data-app-id="meituan_waimai"]';
  const open = async route => {
    await page.evaluate(route => window.__OS__.openApp('meituan_waimai', route), route);
    await page.waitForSelector(`${app} .mt-shell`, { visible: true });
    await new Promise(resolve => setTimeout(resolve, 200));
  };
  const unavailable = async () => {
    assert.equal(await page.$$eval(`${app} .mt-dish`, els => els.length), 0, 'Missing shop must not show another menu');
    assert.equal(await page.$$eval(`${app} .mt-unavailable`, els => els.length), 1);
  };
  await open('/shop/missing-store');
  await unavailable();
  await page.evaluate(() => window.__SIM__.setState({ apps: { meituan_waimai: {
    shops: { rice: null }, cart: { shopId: 'rice', quantities: { chicken: 2 } },
  } } }, { deep: true }));
  await open('/');
  assert.equal(await page.$$eval(`${app} .mt-shop-card`, els => els.length), 3);
  assert.equal(await page.$$eval(`${app} .mt-shop-card`, els => els.some(el => JSON.parse(el.dataset.triggerParams).id === 'rice')), false);
  await open('/shop/rice'); await unavailable();
  await open('/cart'); await unavailable();
  const hiddenCart = await page.evaluate(() => window.__SIM__.getState().apps.meituan_waimai);
  assert.deepEqual(hiddenCart.cart, { shopId: 'rice', quantities: { chicken: 2 } });
  assert.equal(hiddenCart.cart_summary.valid, false);
  assert.equal(hiddenCart.cart_summary.subtotalCents, null);
  await page.evaluate(() => window.__SIM__.setState({ apps: { meituan_waimai: {
    shops: { salad: null, tea: null, market: null },
  } } }, { deep: true }));
  await open('/');
  assert.equal(await page.$$eval(`${app} .mt-shop-card`, els => els.length), 0);
  await open('/cart');
  for (const posture of ['folded', 'unfolded', 'half_folded']) {
    await page.evaluate(posture => window.__FOLDAGENT__.setPosture(posture), posture);
    await new Promise(resolve => setTimeout(resolve, 400));
    await unavailable();
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__SIM__ && window.__OS__));
  await open('/cart'); await unavailable();
  await page.evaluate(() => window.__OS__.locale.setLocale('en'));
  await page.waitForFunction(() => document.querySelector('.mt-unavailable')?.textContent.includes('unavailable'));
  const id = '测试 店/one';
  await page.evaluate(id => window.__SIM__.setState({ apps: { meituan_waimai: {
    shops: { [id]: { id, name: 'Identity test store', categoryId: 'food', category: 'Food',
      rating: '4', sales: '1', time: '10 min', dishes: [
        { id: 'meal', name: 'Identity test meal', price: 12.3, note: 'Synthetic', emoji: '🍱' },
      ] } },
  } } }, { deep: true }), id);
  await open('/');
  await page.click(`${app} .mt-shop-card`);
  await page.waitForSelector(`${app} .mt-dish`);
  assert.ok(await page.$eval(`${app} .mt-shop-banner`, el => el.textContent.includes('Identity test store')));
  // Browsing must retain the unavailable old cart until explicit confirmation.
  assert.deepEqual((await page.evaluate(() => window.__SIM__.getState().apps.meituan_waimai)).cart,
    { shopId: 'rice', quantities: { chicken: 2 } });
  await page.click(`${app} [data-action="meituan.cart.switch.submit"]`);
  await page.click(`${app} [data-action="meituan.cart.item.add"]`);
  const selected = await page.evaluate(() => window.__SIM__.getState().apps.meituan_waimai);
  assert.equal(selected.cart.shopId, id);
  assert.deepEqual(selected.cart.quantities, { meal: 1 });
  assert.equal(selected.cart_summary.subtotalCents, 1230);
  assert.equal(selected.user.orderIds.length, 0);
  await page.evaluate(id => window.__SIM__.setState({ apps: { meituan_waimai: {
    shops: { [id]: { id, name: 'Identity test store', categoryId: 'food', category: 'Food',
      rating: '4', sales: '1', time: '10 min', dishes: [] } },
  } } }, { deep: true }), id);
  await open('/cart');
  await page.waitForSelector(`${app} .mt-invalid-cart`);
  assert.equal(await page.$eval(`${app} .mt-checkout button`, el => el.disabled), true);
  assert.equal(await page.$eval(`${app} .mt-checkout b`, el => el.textContent), '—');
  await page.click(`${app} [data-action="meituan.cart.clear"]`);
  await page.waitForFunction(() => Object.keys(window.__SIM__.getState().apps.meituan_waimai.cart.quantities).length === 0);
  assert.equal(await page.$$eval(`${app} .mt-invalid-cart`, els => els.length), 0);
  assert.deepEqual(errors, []);
  await page.evaluate(() => window.__SIM__.resetState());
  console.log(JSON.stringify({ passed: true, unknownRouteNoFallback: true, tombstones: true,
    allHidden: true, staleCartPreservedAndInvalid: true, removedDishRecovery: true, reload: true, encodedIdentity: true,
    postures: 3, localizedEmptyState: true, scope: 'Development regression, not full CW06 qualification' }));
} finally { await browser.close(); }
