import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

// Private diagnostic seeding only. Synthetic dirty state is not an agent result.
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const hash = value => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const app = '[data-app-id="meituan_waimai"]';
const fixture = { id: 'rice', name: '重置回归测试店', categoryId: 'food', category: '美食',
  rating: '4.8', sales: '月售 100+', time: '约 20 分钟', dishes: [
    { id: 'chicken', name: '重置测试餐', price: 12.3, note: '离线验证', emoji: '🍱' },
  ] };
const reports = [];
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto('http://127.0.0.1:3100/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__SIM__?.getState().apps.meituan_waimai));
  const snapshot = () => page.evaluate(() => window.__SIM__.getState().apps.meituan_waimai);
  const baseline = await snapshot();
  let seededHash;
  for (let cycle = 0; cycle < 10; cycle++) {
    await page.evaluate(cycle => window.__SIM__.setState({ apps: { meituan_waimai: {
      shops: { stale: { id: 'stale', name: `Old store ${cycle}`, categoryId: 'food', category: 'Food',
        rating: '4', sales: '1', time: '10', dishes: [] } },
      cart: { shopId: 'stale', quantities: { oldDish: cycle + 1 } },
      user: { orderIds: ['old-order'] }, orders: { 'old-order': { id: 'old-order', shopId: 'stale',
        shopName: 'Old', items: [], total: 99, status: 'simulated' } }, nextOrderNumber: 42,
    } } }, { deep: true }), cycle);
    await page.evaluate(() => window.__SIM__.resetState());
    assert.deepEqual(await snapshot(), baseline, `Dirty state survives reset: cycle ${cycle}`);
    await page.evaluate(fixture => window.__SIM__.setState({ apps: { meituan_waimai: {
      shops: { rice: fixture }, cart: { shopId: 'rice', quantities: {} },
    } } }, { deep: true }), fixture);
    const seeded = await snapshot();
    seededHash ??= hash(seeded);
    assert.equal(hash(seeded), seededHash);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__SIM__?.getState().apps.meituan_waimai));
    assert.deepEqual(await snapshot(), seeded, `Seed changed after reload: cycle ${cycle}`);
    await page.evaluate(() => window.__OS__.openApp('meituan_waimai', '/shop/rice'));
    await page.waitForSelector(`${app} .mt-dish`);
    assert.ok(await page.$eval(`${app} .mt-dish`, el => el.textContent.includes('重置测试餐') && el.textContent.includes('12.30')));
    await page.click(`${app} [data-action="meituan.cart.item.add"]`);
    await page.waitForFunction(() => window.__SIM__.getState().apps.meituan_waimai.cart.quantities.chicken === 1);
    const changed = await snapshot();
    assert.equal(changed.cart_summary.subtotalCents, 1230);
    assert.deepEqual(changed.user.orderIds, []);
    reports.push({ cycle, resetHash: hash(baseline), seededHash, persistedSeedRetained: true, uiAdditionVerified: true });
  }
  await page.evaluate(() => window.__SIM__.resetState());
  assert.deepEqual(await snapshot(), baseline);
  assert.deepEqual(errors, []);
  const result = { passed: true, cycles: reports.length, scope: 'One diagnostic fixture; not all CW06 instances or model evaluation', reports };
  if (process.argv[2]) {
    fs.mkdirSync(path.dirname(process.argv[2]), { recursive: true });
    fs.writeFileSync(process.argv[2], JSON.stringify(result, null, 2));
  }
  console.log(JSON.stringify({ ...result, reports: undefined }));
} finally { await browser.close(); }
