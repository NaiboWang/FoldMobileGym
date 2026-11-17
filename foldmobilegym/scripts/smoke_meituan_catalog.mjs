import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

// Diagnostic scenario setup only, never an agent observation/action surface.
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const app = '[data-app-id="meituan_waimai"]';
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto('http://127.0.0.1:3100/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-launcher="true"]');
  await page.evaluate(() => window.__SIM__.setState({ apps: { meituan_waimai: {
    shops: { rice: { id: 'rice', name: '菜单回归测试店', categoryId: 'food', category: '美食',
      rating: '4.8', sales: '月售 100+', time: '约 20 分钟', dishes: [
        { id: 'chicken', name: '回归测试餐', price: 12.3, note: '离线数据验证', emoji: '🍱' },
      ] } },
    cart: { shopId: 'rice', quantities: {} },
  } } }, { deep: true }));
  await page.evaluate(() => window.__OS__.openApp('meituan_waimai'));
  await page.waitForSelector(`${app} .mt-shop-card`);
  assert.ok(await page.$eval(`${app} .mt-shop-list`, el => el.textContent.includes('菜单回归测试店')));
  await page.click(`${app} .mt-shop-card[data-trigger-params='{"id":"rice"}']`);
  await page.waitForSelector(`${app} .mt-dish`);
  assert.ok(await page.$eval(`${app} .mt-dish`, el => el.textContent.includes('回归测试餐') && el.textContent.includes('12.30')));
  await page.click(`${app} [data-action="meituan.cart.item.add"]`);
  await page.click(`${app} [data-trigger="meituan.cart.open"]`);
  await page.waitForSelector(`${app} .mt-cart-row`);
  assert.ok(await page.$eval(`${app} .mt-cart-row`, el => el.textContent.includes('回归测试餐') && el.textContent.includes('12.30')));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-launcher="true"]');
  await page.evaluate(() => window.__OS__.openApp('meituan_waimai', '/cart'));
  await page.waitForSelector(`${app} .mt-cart-row`);
  assert.ok(await page.$eval(`${app} .mt-cart-row`, el => el.textContent.includes('回归测试餐') && el.textContent.includes('12.30')));
  const state = await page.evaluate(() => window.__SIM__.getState().apps.meituan_waimai);
  assert.equal(state.cart.shopId, 'rice');
  assert.deepEqual(state.cart.quantities, { chicken: 1 });
  assert.equal(state.user.orderIds.length, 0);
  assert.equal(state.cart_summary.valid, true);
  assert.equal(state.cart_summary.shopName, '菜单回归测试店');
  assert.equal(state.cart_summary.quantity, 1);
  assert.equal(state.cart_summary.subtotalCents, 1230);
  assert.deepEqual(state.cart_summary.items, [{ dishId: 'chicken', name: '回归测试餐',
    quantity: 1, unitPriceCents: 1230, subtotalCents: 1230 }]);
  const duplicatesTotal = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('meituan_waimai'));
    return Object.hasOwn(raw.state ?? raw, 'cart_summary');
  });
  assert.equal(duplicatesTotal, false, 'Derived summary must not be duplicated in persistence');
  const checkoutTest = process.argv.includes('--checkout');
  if (checkoutTest) {
    await page.click(`${app} .mt-checkout button`);
    await page.waitForSelector(`${app} .mt-order-mark`);
    const committed = await page.evaluate(() => window.__SIM__.getState().apps.meituan_waimai);
    assert.equal(committed.user.orderIds.length, 1);
    const order = committed.orders[committed.user.orderIds[0]];
    assert.equal(order.shopId, 'rice');
    assert.equal(order.shopName, '菜单回归测试店');
    assert.equal(order.total, 12.3);
    assert.deepEqual(order.items, [{ dishId: 'chicken', name: '回归测试餐', quantity: 1, unitPrice: 12.3 }]);
    assert.deepEqual(committed.cart.quantities, {});
  }
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(JSON.stringify({ passed: true, injectedCatalogVisible: true, cartPriceConsistent: true,
    reloadRetained: true, noCheckout: !checkoutTest, simulatedCheckoutVerified: checkoutTest }));
} finally { await browser.close(); }
