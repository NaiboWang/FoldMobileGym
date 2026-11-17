import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

// Separate browser profile: never resets or changes the user's current session.
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const app = '[data-app-id="meituan_waimai"]';
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto(process.argv[2] || 'http://127.0.0.1:3100/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-launcher="true"]');
  await page.evaluate(() => window.__OS__.openApp('meituan_waimai'));
  await page.waitForSelector(`${app} .mt-hero`);
  const heroHeight = await page.$eval(`${app} .mt-hero`, el => parseFloat(getComputedStyle(el).minHeight));
  assert.ok(heroHeight <= 112, `Hero min-height: ${heroHeight}`);
  await page.click(`${app} .mt-shop-card[data-trigger-params='{"id":"rice"}']`);
  const add = `${app} .mt-dish [data-action="meituan.cart.item.add"][data-action-params='{"itemId":"chicken"}']`;
  await page.waitForSelector(add);
  await page.click(add);
  await page.click(add);
  await page.waitForFunction(() => document.querySelector('[data-app-id="meituan_waimai"] .mt-cart-quantity')?.textContent.includes('2'));
  await page.click(`${app} [data-trigger="meituan.cart.open"]`);
  await page.waitForSelector(`${app} .mt-cart-row`);
  for (const posture of ['folded', 'unfolded', 'half_folded']) {
    await page.evaluate(p => window.__FOLDAGENT__.setPosture(p), posture);
    await new Promise(resolve => setTimeout(resolve, 450));
    const metrics = await page.$eval(`${app} .mt-cart-main`, el => ({
      overflow: el.scrollWidth > el.clientWidth + 1,
      text: el.textContent,
      buttons: [...el.querySelectorAll('.mt-quantity button')].map(button => ({
        width: parseFloat(getComputedStyle(button).width), height: parseFloat(getComputedStyle(button).height),
      })),
    }));
    assert.equal(metrics.overflow, false, `Overflow: ${posture}`);
    assert.ok(metrics.text.includes('49.60'), `Missing subtotal: ${posture}`);
    assert.ok(metrics.buttons.every(b => b.width >= 44 && b.height >= 44));
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-launcher="true"]');
  await page.evaluate(() => window.__OS__.openApp('meituan_waimai', '/cart'));
  await page.waitForSelector(`${app} .mt-cart-row`);
  assert.equal(await page.$eval(`${app} .mt-quantity b`, el => el.textContent), '2');
  assert.ok((await page.$eval(`${app} .mt-checkout`, el => el.textContent)).includes('49.60'));
  await page.click(`${app} [data-action="meituan.cart.item.remove"]`);
  await page.waitForFunction(() => document.querySelector('[data-app-id="meituan_waimai"] .mt-quantity b')?.textContent === '1');
  await page.click(`${app} [data-action="meituan.cart.item.remove"]`);
  await page.waitForSelector(`${app} .mt-empty-cart`);
  assert.equal(await page.$eval(`${app} .mt-checkout button`, el => el.disabled), true);
  const state = await page.evaluate(() => window.__SIM__.getState().apps.meituan_waimai);
  assert.equal(state.user.orderIds.length, 0);
  assert.equal(errors.length, 0, errors.join('\n'));
  if (process.argv[3]) await page.screenshot({ path: process.argv[3], fullPage: true });
  console.log(JSON.stringify({ passed: true, postureTests: 3, quantityFeedback: true,
    persistenceAfterReload: true, noCheckout: true, noHorizontalOverflow: true, emptyCartDisabled: true }));
} finally { await browser.close(); }
