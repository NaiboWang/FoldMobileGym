import assert from 'node:assert/strict';
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
  const field = `${app} .mt-search input`;
  const rows = [];
  for (const posture of ['folded', 'unfolded', 'half_folded']) {
    await page.evaluate(posture => window.__FOLDAGENT__.setPosture(posture), posture);
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 400)));
    await page.evaluate(() => window.__OS__.openApp('meituan_waimai', '/'));
    await page.waitForSelector(field, { visible: true });
    const initial = await page.evaluate(() => window.__SIM__.getState().apps.meituan_waimai);
    await page.type(field, '鸡');
    await page.click(`${app} [data-trigger="meituan.home.category.food"]`);
    await page.waitForFunction(app => document.querySelector(`${app} [data-trigger="meituan.home.category.food"]`)
      ?.classList.contains('selected'), {}, app);
    await page.waitForSelector(`${app} .mt-shop-card`);
    const filtered = await page.$$eval(`${app} .mt-shop-card`, nodes => nodes.map(node => JSON.parse(node.dataset.triggerParams).id));
    assert.ok(filtered.length > 0);
    for (const locale of ['en', 'zh-Hans']) {
      await page.evaluate(locale => window.__OS__.locale.setLocale(locale), locale);
      await page.waitForFunction(({ field, locale }) => document.querySelector(field)?.placeholder
        === (locale === 'en' ? 'Search shops and items' : '搜索商家、商品'), {}, { field, locale });
      assert.equal(await page.$eval(field, node => node.value), '鸡');
      assert.deepEqual(await page.$$eval(`${app} .mt-shop-card`, nodes => nodes.map(node => JSON.parse(node.dataset.triggerParams).id)), filtered);
      assert.ok(await page.$eval(`${app} [data-trigger="meituan.home.category.food"]`, node => node.classList.contains('selected')));
    }
    await page.click(`${app} .mt-shop-card`);
    await page.waitForSelector(`${app} .mt-menu-tabs`, { visible: true });
    await page.click(`${app} .mt-header button`);
    await page.waitForSelector(field, { visible: true });
    assert.equal(await page.$eval(field, node => node.value), '鸡', 'Returning from a shop must preserve the query');
    assert.ok(await page.$eval(`${app} [data-trigger="meituan.home.category.food"]`, node => node.classList.contains('selected')));
    assert.deepEqual(await page.$$eval(`${app} .mt-shop-card`, nodes => nodes.map(node => JSON.parse(node.dataset.triggerParams).id)), filtered);
    // Shop tabs replace the shop entry; cart pushes one entry. Back must pop
    // cart -> selected shop section -> the original filtered homepage.
    await page.click(`${app} .mt-shop-card`);
    await page.waitForSelector(`${app} .mt-menu-tabs`, { visible: true });
    await page.click(`${app} [data-trigger="meituan.shop.reviews"]`);
    await page.waitForSelector(`${app} .mt-review`);
    await page.click(`${app} [data-trigger="meituan.cart.open"]`);
    await page.waitForSelector(`${app} .mt-cart-main`, { visible: true });
    await page.click(`${app} .mt-header button`);
    await page.waitForSelector(`${app} .mt-review`, { visible: true });
    await page.click(`${app} .mt-header button`);
    await page.waitForSelector(field, { visible: true });
    assert.equal(await page.$eval(field, node => node.value), '鸡');
    assert.ok(await page.$eval(`${app} [data-trigger="meituan.home.category.food"]`, node => node.classList.contains('selected')));
    // An explicit Home action still intentionally clears the search/category.
    await page.click(`${app} [data-trigger="meituan.home.open"]`);
    await page.waitForFunction(field => document.querySelector(field)?.value === '', {}, field);
    assert.ok(await page.$eval(`${app} [data-trigger="meituan.home.category.all"]`, node => node.classList.contains('selected')));
    // Activate the first shop via actual Tab/Enter before the 250 ms URL
    // debounce. Pointer timing during keyboard resize is not qualified here.
    await page.click(field);
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));
    const started = await page.evaluate(() => performance.now());
    await page.type(field, '鸡');
    for (let tab = 0; tab < 5; tab++) await page.keyboard.press('Tab');
    assert.ok(await page.evaluate(app => document.activeElement?.matches(`${app} .mt-shop-card`), app));
    await page.keyboard.press('Enter');
    const rapidElapsedMs = await page.evaluate(started => performance.now() - started, started);
    assert.ok(rapidElapsedMs < 250, `Rapid input test did not reach the debounce window: ${rapidElapsedMs} ms`);
    await page.waitForSelector(`${app} .mt-menu-tabs`, { visible: true });
    await page.click(`${app} .mt-header button`);
    await page.waitForSelector(field, { visible: true });
    assert.equal(await page.$eval(field, node => node.value), '鸡');
    await page.evaluate(() => window.__OS__.openApp('meituan_waimai', '/'));
    await page.waitForFunction(field => document.querySelector(field)?.value === '', {}, field);
    // Direct links reuse the existing app history. They must reach the prior
    // homepage or cart shop and return home within at most two Back presses.
    await page.evaluate(() => window.__OS__.openApp('meituan_waimai', '/shop/rice'));
    await page.waitForSelector(`${app} .mt-menu-tabs`, { visible: true });
    await page.click(`${app} .mt-header button`);
    await page.waitForSelector(field, { visible: true });
    await page.evaluate(() => window.__OS__.openApp('meituan_waimai', '/cart'));
    await page.waitForSelector(`${app} .mt-cart-main`, { visible: true });
    await page.click(`${app} .mt-header button`);
    await page.waitForFunction(app => Boolean(document.querySelector(`${app} .mt-search input`)
      || document.querySelector(`${app} .mt-menu-tabs`)), {}, app);
    const directCartBackTarget = await page.$(`${app} .mt-menu-tabs`) ? 'shop' : 'home';
    if (directCartBackTarget === 'shop') await page.click(`${app} .mt-header button`);
    await page.waitForSelector(field, { visible: true });
    assert.deepEqual(await page.evaluate(() => window.__SIM__.getState().apps.meituan_waimai), initial);
    rows.push({ posture, localeSwitches: 2, queryAndCategoryRetained: true, returnRetained: true,
      nestedBack: true, explicitHomeResets: true, rapidElapsedMs, deepLinkBack: true,
      directCartBackTarget, sourceUnchanged: true });
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, rows, pageErrors: errors,
    scope: 'Ordinary search/filter/return UI regression; not controlled recovery or bilingual task qualification' }));
} finally { await browser.close(); }
