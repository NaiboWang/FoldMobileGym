// Local cart specification/quantity editing only. Never purchases or calls commerce services.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { openPilotApp } from '../browser-automation/pilot_app_navigation.mjs';
import { resolveBrowserExecutable } from '../browser-automation/browser.mjs';
fs.mkdirSync(path.resolve(import.meta.dirname, '../../artifacts'), { recursive: true });

const root = path.resolve(import.meta.dirname, '../..');
const frontend = fs.existsSync(path.join(root, 'foldmobilegym/package.json')) ? 'foldmobilegym' : 'mobilegym';
const require = createRequire(path.join(root, frontend, 'package.json'));
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3324/');
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && !url.username && !url.password);
const output = fs.mkdtempSync(path.join(root, 'artifacts/taobao-cart-sku-'));
const browser = await require('puppeteer').launch({ headless: true, executablePath: resolveBrowserExecutable() });
const app = '[data-app-id="taobao"]', sheet = `${app} .tb-cart-sku-sheet`, productId = 'portable_monitor_x1';
const checks = [], failures = [], errors = [], writes = [], selectedCase = process.env.FOLDAGENT_REVIEW_CASE || null;
const state = p => p.evaluate(() => window.__SIM__.getState().apps.taobao);
const route = p => p.evaluate(() => window.__OS__.getAppRoute('taobao').path);
const facts = snapshot => Object.fromEntries(['products', 'orders', 'user', 'messages', 'search', 'safetyAudit', 'detailScrollTopByProduct'].map(key => [key, snapshot[key]]));
const base = manage => '/cart' + (manage ? '?manage=1' : '');
const opener = id => `${app} .tb-sku[data-cart-sku-product-id="${id}"]`;
const action = (manage, suffix) => `${sheet} [data-action="taobao.cart.${manage ? 'manage.' : ''}sku.${suffix}"]`;
async function visible(p, selector) {
  await p.waitForFunction(s => [...document.querySelectorAll(s)].some(e => e.checkVisibility()), {}, selector);
  for (const h of await p.$$(selector)) { if (await h.evaluate(e => e.checkVisibility())) return h; await h.dispose(); }
  throw Error('No visible control: ' + selector);
}
async function hit(p, selector) {
  const h = await visible(p, selector); await h.evaluate(e => e.scrollIntoView({ block: 'center', inline: 'nearest' })); await h.dispose();
  await p.waitForFunction(async s => {
    const e = [...document.querySelectorAll(s)].find(e => e.checkVisibility() && !e.disabled); if (!e) return false;
    const a = e.getBoundingClientRect(); await new Promise(r => requestAnimationFrame(r)); const b = e.getBoundingClientRect();
    const target = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    return Math.abs(a.x - b.x) < .5 && Math.abs(a.y - b.y) < .5 && (target === e || e.contains(target));
  }, {}, selector);
  const button = await visible(p, selector); try { await button.click(); } finally { await button.dispose(); }
}
async function expectBase(p, manage) {
  await p.waitForSelector(sheet, { hidden: true });
  await p.waitForFunction(target => window.__OS__.getAppRoute('taobao').path === target, {}, base(manage));
  await p.evaluate(() => new Promise(r => requestAnimationFrame(r)));
}
async function ready(p, locale = 'zh-Hans', posture = 'unfolded') {
  await p.setViewport({ width: 1440, height: 1100 }); await p.goto(url.href, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__OS__ && window.__SIM__ && window.__FOLDAGENT__);
  await p.evaluate(({ locale, posture }) => { window.__OS__.locale.setLocale(locale); window.__FOLDAGENT__.setPosture(posture); }, { locale, posture });
  await openPilotApp(p, 'taobao', '/cart'); await visible(p, `${app} .tb-cart-page`);
}
async function addMonitor(p, manage = false) {
  await p.evaluate(() => window.__OS__.openApp('taobao', '/item/portable_monitor_x1'));
  await hit(p, `${app} .tb-cart-button`); await visible(p, `${app} .tb-detail-page .tb-sku-sheet`);
  await hit(p, `${app} [data-action="taobao.item.sku.quantity.increment"]`);
  await hit(p, `${app} [data-action="taobao.item.cart.submit"]`);
  await p.waitForFunction(() => window.__SIM__.getState().apps.taobao.cartItems.some(row => row.productId === 'portable_monitor_x1' && row.quantity === 2 && row.variantId === 'x1_13'));
  await hit(p, `${app} .tb-detail-cart-entry`);
  if (manage) await hit(p, `${app} [data-trigger="taobao.cart.manage.open"]`);
  await p.waitForFunction(target => window.__OS__.getAppRoute('taobao').path === target, {}, base(manage));
}
async function openSheet(p, id = productId) {
  await hit(p, opener(id)); await visible(p, sheet);
  await p.waitForFunction(() => new URLSearchParams(window.__OS__.getAppRoute('taobao').path.split('?')[1]).get('sheet') === 'sku');
}
async function geometry(p) {
  return p.$eval(sheet, e => {
    const panel = e.getBoundingClientRect(), owner = e.closest('[data-app-id]').getBoundingClientRect();
    return { inside: panel.left >= owner.left && panel.right <= owner.right && panel.top >= owner.top && panel.bottom <= owner.bottom,
      focus: e.contains(document.activeElement), inert: !!e.closest('.tb-cart-page').querySelector('[inert]') };
  });
}
async function choose(p, manage, variantId) { await hit(p, `${action(manage, 'select')}[data-action-params*="${variantId}"]`); }
async function quantity(p) { return Number(await p.$eval(`${sheet} [data-cart-sku-quantity]`, e => e.textContent)); }
async function patch(p, patcher) { await p.evaluate(patcher); await p.evaluate(() => new Promise(r => requestAnimationFrame(r))); }
async function run(name, fn) {
  if (selectedCase && selectedCase !== name) return;
  const context = await browser.createBrowserContext(), p = await context.newPage();
  p.on('pageerror', error => errors.push({ name, error: String(error) }));
  p.on('request', request => { if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) writes.push({ name, method: request.method(), url: request.url() }); });
  try { await fn(p); checks.push(name); console.log('PASS ' + name); }
  catch (error) { failures.push({ name, error: String(error.stack) }); console.error('FAIL ' + name + ': ' + error.stack); await p.screenshot({ path: path.join(output, `${name}-failure.png`) }).catch(() => {}); }
  finally { await context.close(); }
}
try {
  for (const locale of ['zh-Hans', 'en']) for (const posture of ['folded', 'unfolded']) for (const manage of [false, true]) {
    const name = `${locale}-${posture}-${manage ? 'manage' : 'normal'}-edit-cancel-save-reload`;
    await run(name, async p => {
      await ready(p, locale, posture); await addMonitor(p, manage); const before = await state(p);
      await openSheet(p); const offset = await p.$eval(`${app} .tb-cart-list`, e => e.scrollTop);
      assert.deepEqual(await geometry(p), { inside: true, focus: true, inert: true });
      assert.equal(await quantity(p), 2); assert.equal(await p.$eval(sheet, e => e.dataset.benchmarkSkuVariantId), 'x1_13');
      await choose(p, manage, 'x1_15'); await hit(p, action(manage, 'increment')); assert.equal(await quantity(p), 3);
      assert.deepEqual(await state(p), before, 'Draft options must not modify the cart before explicit Save');
      await p.keyboard.press('Tab'); assert.equal((await geometry(p)).focus, true);
      await p.keyboard.press('Escape'); await expectBase(p, manage); assert.deepEqual(await state(p), before);
      assert.equal(await p.$eval(`${app} .tb-cart-list`, e => e.scrollTop), offset);
      assert.equal(await p.evaluate(() => document.activeElement?.dataset.cartSkuProductId), productId);
      await openSheet(p); assert.equal(await quantity(p), 2); await choose(p, manage, 'x1_15'); await hit(p, action(manage, 'increment'));
      const retained = await p.$(sheet); await p.evaluate(posture => window.__FOLDAGENT__.setPosture(posture === 'folded' ? 'unfolded' : 'folded'), posture);
      assert.equal(await retained.evaluate(e => e.isConnected), true); assert.equal(await quantity(p), 3);
      assert.equal(await p.$eval(sheet, e => e.dataset.benchmarkSkuVariantId), 'x1_15'); assert.equal((await geometry(p)).inside, true);
      await p.evaluate(posture => window.__FOLDAGENT__.setPosture(posture), posture); await retained.dispose();
      await p.screenshot({ path: path.join(output, `${name}-sheet.png`) }); await hit(p, `${sheet} [data-cart-sku-submit]`); await expectBase(p, manage);
      const after = await state(p), row = after.cartItems.find(row => row.productId === productId), original = before.cartItems.find(row => row.productId === productId);
      assert.deepEqual(row, { ...original, quantity: 3, variantId: 'x1_15', sku: '15.6英寸；2.5K；780g' });
      assert.deepEqual(after.cartItems.filter(row => row.productId !== productId), before.cartItems.filter(row => row.productId !== productId));
      assert.equal(after.cartItems.length, before.cartItems.length); assert.deepEqual(facts(after), facts(before));
      const total = after.cartItems.filter(row => row.selected).reduce((sum, row) => { const product = after.products.find(product => product.id === row.productId);
        return sum + (product.variants?.find(variant => variant.id === row.variantId)?.price ?? product.price) * row.quantity; }, 0);
      assert.equal(await p.evaluate(() => document.activeElement?.dataset.cartSkuProductId), productId);
      if (manage) {
        const count = after.cartItems.filter(row => row.selected).reduce((sum, row) => sum + row.quantity, 0);
        assert.equal(Number(await p.$eval(`${app} .tb-cart-managebar small`, e => e.textContent.match(/\d+/)?.[0])), count);
        await hit(p, `${app} .tb-cart-header > button.active`); await expectBase(p, false);
      }
      assert.equal(Number(await p.$eval(`${app} .tb-cart-total p strong`, e => e.textContent.replace(/[^\d.]/g, ''))), total);
      if (manage) { await hit(p, `${app} [data-trigger="taobao.cart.manage.open"]`); await expectBase(p, true); }
      await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => window.__SIM__ && window.__OS__); await openPilotApp(p, 'taobao', base(manage));
      assert.deepEqual((await state(p)).cartItems, after.cartItems); await openSheet(p); assert.equal(await quantity(p), 3);
      assert.equal(await p.$eval(sheet, e => e.dataset.benchmarkSkuVariantId), 'x1_15');
      await hit(p, `${sheet} .tb-sku-close`); await expectBase(p, manage); assert.deepEqual((await state(p)).cartItems, after.cartItems);
    });
  }
  for (const locale of ['zh-Hans', 'en']) for (const posture of ['folded', 'unfolded']) await run(`${locale}-${posture}-retain-known-cart-option-without-invented-variants`, async p => {
    await ready(p, locale, posture); const before = await state(p), original = before.cartItems.find(row => row.productId === 'phone');
    await openSheet(p, 'phone'); assert.equal(await p.$eval(`${sheet} header p`, e => e.textContent), original.sku);
    assert.deepEqual(await p.$$eval(`${sheet} .tb-sku-options button`, es => es.map(e => ({ disabled: e.disabled, text: e.textContent }))), [{ disabled: true, text: original.sku }]);
    await hit(p, action(false, 'increment')); assert.deepEqual(await state(p), before); await hit(p, `${sheet} [data-cart-sku-submit]`); await expectBase(p, false);
    const after = await state(p); assert.deepEqual(after.cartItems.find(row => row.productId === 'phone'), { ...original, quantity: original.quantity + 1 }); assert.deepEqual(facts(after), facts(before));
  });
  for (const manage of [false, true]) await run(`${manage ? 'manage' : 'normal'}-background-same-frame-source-and-double-save`, async p => {
    await ready(p); await addMonitor(p, manage); await openSheet(p); const before = await state(p), modalRoute = await route(p);
    const save = await p.$(`${sheet} [data-cart-sku-submit]`), increment = await p.$(action(manage, 'increment'));
    await p.$eval(`${app} [data-action="taobao.cart.item.increment"]`, e => e.click());
    const checkout = await p.$(`${app} .tb-checkout`); if (checkout) { await checkout.evaluate(e => e.click()); await checkout.dispose(); }
    await p.$eval(opener('phone'), e => e.click()); assert.deepEqual(await state(p), before); assert.equal(await route(p), modalRoute);
    await openPilotApp(p, 'clock', '/world'); await increment.evaluate(e => e.click()); await save.evaluate(e => e.click());
    assert.deepEqual(await state(p), before); assert.equal(await route(p), modalRoute);
    assert.equal(await p.$eval(sheet, e => e.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))), true);
    await p.evaluate(() => window.__OS__.launchTaskById(window.__OS__.getState().tasks.find(task => task.rootAppId === 'taobao').taskId));
    await save.evaluate(e => { window.__OS__.handleBack(); e.click(); }); await expectBase(p, manage); assert.deepEqual(await state(p), before);
    await save.dispose(); await increment.dispose(); await openSheet(p); await choose(p, manage, 'x1_15');
    const stale = await p.$(`${sheet} [data-cart-sku-submit]`);
    await stale.evaluate(e => { const state = window.__SIM__.getState().apps.taobao;
      window.__SIM__.setState({ apps: { taobao: { cartItems: state.cartItems.map(row => row.productId === 'portable_monitor_x1' ? { ...row, quantity: row.quantity + 1 } : row) } } }, { deep: false, reload: false }); e.click(); });
    await p.waitForFunction(sheet => document.querySelector(`${sheet} [data-cart-sku-submit]`).disabled, {}, sheet);
    const changed = await state(p); assert.deepEqual(changed.cartItems.find(row => row.productId === productId), { ...before.cartItems.find(row => row.productId === productId), quantity: 3 });
    await p.keyboard.press('Escape'); await expectBase(p, manage); await stale.dispose(); await openSheet(p); assert.equal(await quantity(p), 3);
    await hit(p, action(manage, 'increment')); const twice = await p.$(`${sheet} [data-cart-sku-submit]`); await twice.evaluate(e => { e.click(); e.click(); });
    await expectBase(p, manage); assert.equal((await state(p)).cartItems.find(row => row.productId === productId).quantity, 4); await twice.dispose();
    assert.deepEqual((await state(p)).safetyAudit, before.safetyAudit);
  });
  for (const manage of [false, true]) await run(`${manage ? 'manage' : 'normal'}-same-frame-pending-option-quantity-and-save`, async p => {
    await ready(p); await addMonitor(p, manage); await openSheet(p); const before = await state(p);
    const emitted = await p.evaluate(({ sheet, manage }) => {
      const prefix = `taobao.cart.${manage ? 'manage.' : ''}sku.`;
      const events = [], record = event => { if (event.detail.id === prefix + 'submit') events.push(event.detail); };
      window.addEventListener('mobilegym:agent-action', record);
      document.querySelector(`${sheet} [data-action="${prefix}select"][data-action-params*="x1_15"]`).click();
      const increment = document.querySelector(`${sheet} [data-action="${prefix}increment"]`); increment.click(); increment.click();
      document.querySelector(`${sheet} [data-cart-sku-submit]`).click();
      window.removeEventListener('mobilegym:agent-action', record); return events;
    }, { sheet, manage });
    assert.deepEqual(emitted.map(event => ({ kind: event.kind, params: event.params })), [{ kind: 'action', params: { productId, quantity: 4 } }]);
    await expectBase(p, manage); const after = await state(p);
    assert.deepEqual(after.cartItems.find(row => row.productId === productId), { ...before.cartItems.find(row => row.productId === productId),
      quantity: 4, variantId: 'x1_15', sku: '15.6英寸；2.5K；780g' });
    assert.deepEqual(facts(after), facts(before));
  });
  for (const kind of ['repriced-product', 'removed-entry']) await run(`${kind}-does-not-overwrite-or-recreate-source`, async p => {
    await ready(p); await addMonitor(p); await openSheet(p); const before = await state(p), stale = await p.$(`${sheet} [data-cart-sku-submit]`);
    await stale.evaluate((e, kind) => { const state = window.__SIM__.getState().apps.taobao;
      const data = kind === 'removed-entry' ? { cartItems: state.cartItems.filter(row => row.productId !== 'portable_monitor_x1') }
        : { products: state.products.map(product => product.id === 'portable_monitor_x1' ? { ...product, price: product.price + 7 } : product) };
      window.__SIM__.setState({ apps: { taobao: data } }, { deep: false, reload: false }); e.click(); }, kind);
    await p.waitForFunction(sheet => document.querySelector(`${sheet} [data-cart-sku-submit]`).disabled, {}, sheet);
    const after = await state(p); assert.deepEqual(after.safetyAudit, before.safetyAudit);
    assert.deepEqual(after.cartItems, kind === 'removed-entry' ? before.cartItems.filter(row => row.productId !== productId) : before.cartItems);
    await p.keyboard.press('Escape'); await expectBase(p, false); await stale.dispose();
  });
  for (const manage of [false, true]) for (const missing of [false, true]) await run(`cold-${manage ? 'manage' : 'normal'}-${missing ? 'missing' : 'existing'}-source-close`, async p => {
    await ready(p); await openPilotApp(p, 'taobao', '/me'); const before = await state(p);
    await p.evaluate(({ manage, missing }) => window.__OS__.openApp('taobao', `/cart?${manage ? 'manage=1&' : ''}sheet=sku&productId=${missing ? 'absent-local-qa' : 'phone'}`), { manage, missing });
    await visible(p, sheet); if (missing) assert.equal(await p.$eval(`${sheet} [data-cart-sku-submit]`, e => e.disabled), true);
    await p.evaluate(() => window.__OS__.handleBack()); await expectBase(p, manage); assert.deepEqual(await state(p), before);
  });
  for (const orientation of ['side_by_side', 'stacked']) await run(`${orientation}-sheet-belongs-to-taobao-not-clock`, async p => {
    await ready(p); await addMonitor(p); await openPilotApp(p, 'clock', '/world');
    await p.evaluate(orientation => { const tasks = window.__OS__.getState().tasks, tb = tasks.find(task => task.rootAppId === 'taobao'), clock = tasks.find(task => task.rootAppId === 'clock');
      window.__FOLDAGENT__.setMultiWindow('split', tb.taskId, clock.taskId, .5, null, .5, orientation); window.__OS__.launchTaskById(tb.taskId); }, orientation);
    await openSheet(p); assert.equal((await geometry(p)).inside, true);
    assert.equal(await p.evaluate(() => { const rect = document.querySelector('[data-app-id="clock"]').getBoundingClientRect();
      return document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.closest('[data-app-id]')?.getAttribute('data-app-id'); }), 'clock');
    await choose(p, false, 'x1_15'); await hit(p, action(false, 'increment')); await hit(p, `${sheet} [data-cart-sku-submit]`); await expectBase(p, false);
    assert.equal((await state(p)).cartItems.find(row => row.productId === productId).variantId, 'x1_15');
  });
  await run('legacy-row-save-does-not-normalize-unrelated-legacy-data', async p => {
    await ready(p); await patch(p, () => window.__SIM__.setState({ apps: { taobao: { cartItems: ['phone', 'bag'] } } }, { deep: false, reload: false }));
    await openSheet(p, 'phone'); await hit(p, action(false, 'increment')); await hit(p, `${sheet} [data-cart-sku-submit]`); await expectBase(p, false);
    assert.deepEqual((await state(p)).cartItems, [{ productId: 'phone', quantity: 2, selected: true, sku: '默认规格' }, 'bag']);
  });
  await run('foreground-controlled-checkout-attempt-is-still-counted-not-purchased', async p => {
    await ready(p); const before = await state(p); await hit(p, `${app} .tb-checkout`); const after = await state(p);
    assert.deepEqual(after.cartItems, before.cartItems); assert.deepEqual(after.safetyAudit, { ...before.safetyAudit,
      checkoutAttempts: before.safetyAudit.checkoutAttempts + 1, violationCount: before.safetyAudit.violationCount + 1, lastAttempt: 'checkout' });
  });
} finally {
  if (selectedCase && !checks.length && !failures.length) failures.push({ name: selectedCase, error: 'No matching case was executed' });
  await browser.close(); fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: !failures.length && !errors.length && !writes.length,
    url: url.href, selectedCase, checks, failures, errors, writes, scope: 'Local cart SKU/quantity, original source safety and controlled-attempt truth; no real purchase/payment or complete native certification' }, null, 2));
  console.log(JSON.stringify({ passed: !failures.length && !errors.length && !writes.length, output, checks: checks.length, failures: failures.length, errors, writes }));
  if (failures.length || errors.length || writes.length) process.exitCode = 1;
}
