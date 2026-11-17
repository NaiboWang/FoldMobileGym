// Disposable browser review of the recorded Personal Favorites → full-width detail surface.
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
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3314/');
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && !url.username && !url.password);
const output = fs.mkdtempSync(path.join(root, 'artifacts/contacts-favorites-'));
const browser = await require('puppeteer').launch({ headless: true, executablePath: resolveBrowserExecutable() });
const app = '[data-app-id="contacts"]';
const checks = [], failures = [], errors = [], writes = [], callScrollMeasurements = [];
const route = page => page.evaluate(() => window.__OS__.getAppRoute('contacts').path);
async function hit(page, selector) {
  await page.waitForFunction(async s => {
    const element = [...document.querySelectorAll(s)].find(e => e.checkVisibility() && !e.disabled);
    if (!element) return false;
    const a = element.getBoundingClientRect(); await new Promise(r => requestAnimationFrame(r));
    const b = element.getBoundingClientRect(), target = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    return Math.abs(a.x - b.x) < .5 && Math.abs(a.y - b.y) < .5 && (target === element || element.contains(target));
  }, {}, selector);
  const handles = await page.$$(selector);
  try { for (const handle of handles) if (await handle.evaluate(e => e.checkVisibility() && !e.disabled)) { await handle.click(); return; } }
  finally { for (const handle of handles) await handle.dispose(); }
  throw Error(`No visible control: ${selector}`);
}
async function start(page, locale, posture, initialRoute) {
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__OS__ && window.__SIM__ && window.__FOLDAGENT__);
  await page.evaluate(({ locale, posture }) => { window.__OS__.locale.setLocale(locale); window.__FOLDAGENT__.setPosture(posture); }, { locale, posture });
  await openPilotApp(page, 'contacts', initialRoute);
}
async function openFirstContact(page) {
  await hit(page, `${app} [data-trigger="contact.open"]`);
  await page.waitForSelector(`${app} .contacts-reference-detail`, { visible: true });
  return page.evaluate(() => ({
    route: window.__OS__.getAppRoute('contacts').path,
    app: document.querySelector('[data-app-id="contacts"]').getBoundingClientRect().toJSON(),
    detail: document.querySelector('[data-app-id="contacts"] .contacts-reference-detail').getBoundingClientRect().toJSON(),
    masterVisible: document.querySelector('[data-app-id="contacts"] .contacts-master-pane')?.checkVisibility() ?? false,
    footer: [...document.querySelectorAll('[data-app-id="contacts"] .contacts-detail-footer button')].filter(e => e.checkVisibility()).length,
    topEdit: document.querySelector('[data-app-id="contacts"] .contacts-detail-edit')?.checkVisibility() ?? false,
    qr: document.querySelector('[data-app-id="contacts"] .contacts-detail-qr')?.checkVisibility() ?? false,
  }));
}
async function expectDetail(page, expected) {
  await page.waitForFunction(expected => window.__OS__.getAppRoute('contacts').path === expected
    && document.querySelector('[data-app-id="contacts"] .contacts-detail-footer')?.checkVisibility(), {}, expected);
}
async function run(name, fn) {
  const context = await browser.createBrowserContext(), page = await context.newPage();
  page.on('pageerror', error => errors.push({ name, error: String(error) }));
  page.on('request', request => { if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) writes.push({ name, method: request.method(), url: request.url() }); });
  try { await fn(page); checks.push(name); console.log(`PASS ${name}`); }
  catch (error) { failures.push({ name, error: String(error.stack) }); console.error(`FAIL ${name}: ${error.stack}`); await page.screenshot({ path: path.join(output, `${name}-failure.png`) }).catch(() => {}); }
  finally { await context.close(); }
}

try {
  for (const locale of ['zh-Hans', 'en']) for (const posture of ['folded', 'unfolded']) {
    const tag = `${locale}-${posture}`;
    await run(`${tag}-favorites-full-detail`, async page => {
      await start(page, locale, posture, '/contacts?fav=true');
      const before = await page.evaluate(() => window.__OS__.content.query('content://contacts/contacts').items);
      const state = await openFirstContact(page);
      assert.equal(state.route.includes('fav=true'), true);
      assert.equal(state.masterVisible, false);
      assert.ok(state.detail.width > state.app.width * .9, `detail must own the full app: ${JSON.stringify(state)}`);
      assert.equal(state.footer, 3); assert.equal(state.topEdit, false); assert.equal(state.qr, true);
      assert.deepEqual(await page.evaluate(() => window.__OS__.content.query('content://contacts/contacts').items), before);
      await page.screenshot({ path: path.join(output, `${tag}-favorites.png`) });
      await page.evaluate(() => window.__OS__.handleBack());
      await page.waitForFunction(() => window.__OS__.getAppRoute('contacts').path === '/contacts?fav=true');
    });
    await run(`${tag}-directory-stays-master-detail`, async page => {
      await start(page, locale, posture, '/contacts'); const state = await openFirstContact(page);
      if (posture === 'unfolded') { assert.equal(state.masterVisible, true); assert.ok(state.detail.width < state.app.width * .65); }
      assert.equal(state.footer, 0); assert.equal(state.topEdit, true); assert.equal(state.route.includes('fav=true'), false);
    });
    await run(`${tag}-favorites-edit-preserves-origin`, async page => {
      await start(page, locale, posture, '/contacts?fav=true'); const state = await openFirstContact(page);
      await hit(page, `${app} .contacts-detail-footer [data-trigger="contact.edit.open"]`);
      await page.waitForFunction(() => window.__OS__.getAppRoute('contacts').path.includes('/edit?fav=true'));
      await hit(page, `${app} [data-action="contacts.edit.save.submit"]`);
      await expectDetail(page, state.route);
      assert.equal(await page.$$eval(`${app} .contacts-detail-footer button`, es => es.filter(e => e.checkVisibility()).length), 3);
      await page.evaluate(() => window.__OS__.handleBack());
      await page.waitForFunction(() => window.__OS__.getAppRoute('contacts').path === '/contacts?fav=true');
    });
    await run(`${tag}-menu-and-posture`, async page => {
      await start(page, locale, posture, '/contacts?fav=true'); const state = await openFirstContact(page);
      const rootHandle = await page.$(`${app} .contacts-reference-detail`);
      await hit(page, `${app} .contacts-detail-footer [data-trigger="contact.menu.open"]`);
      await page.waitForFunction(() => window.__OS__.getAppRoute('contacts').path.includes('menu=more'));
      assert.equal((await route(page)).includes('fav=true'), true);
      await page.evaluate(() => window.__OS__.handleBack()); await expectDetail(page, state.route);
      await page.evaluate(other => window.__FOLDAGENT__.setPosture(other), posture === 'folded' ? 'unfolded' : 'folded');
      await expectDetail(page, state.route);
      assert.equal(await rootHandle.evaluate(e => e.isConnected), true);
      await page.waitForFunction(() => {
        const root = document.querySelector('[data-app-id="contacts"]'), detail = root.querySelector('.contacts-reference-detail');
        return detail.getBoundingClientRect().width > root.getBoundingClientRect().width * .9;
      });
      await rootHandle.dispose();
    });
    await run(`${tag}-dirty-discard-does-not-resurrect-editor`, async page => {
      await start(page, locale, posture, '/contacts?fav=true'); const state = await openFirstContact(page);
      const before = await page.evaluate(() => window.__OS__.content.query('content://contacts/contacts').items);
      await hit(page, `${app} .contacts-detail-footer [data-trigger="contact.edit.open"]`);
      await page.waitForSelector(`${app} [data-contact-field="displayName"]`, { visible: true });
      await hit(page, `${app} [data-contact-field="displayName"]`); await page.keyboard.type(' QA');
      if (await page.evaluate(() => window.__OS__.keyboard.isVisible())) {
        await page.evaluate(() => window.__OS__.handleBack()); await page.waitForFunction(() => !window.__OS__.keyboard.isVisible());
        // These are separate user Back inputs, not two duplicate events in one frame.
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
      }
      await page.evaluate(() => window.__OS__.handleBack());
      await page.waitForSelector(`${app} [data-action="contacts.edit.discard.submit"]`, { visible: true });
      assert.equal((await route(page)).includes('fav=true'), true);
      await hit(page, `${app} [data-action="contacts.edit.discard.submit"]`);
      await expectDetail(page, state.route);
      assert.deepEqual(await page.evaluate(() => window.__OS__.content.query('content://contacts/contacts').items), before);
      await page.evaluate(() => window.__OS__.handleBack());
      await page.waitForFunction(() => window.__OS__.getAppRoute('contacts').path === '/contacts?fav=true');
    });
  }
  await run('favorite-toggle-and-background-isolation', async page => {
    await start(page, 'zh-Hans', 'unfolded', '/contacts?fav=true'); const state = await openFirstContact(page);
    const id = state.route.split('?')[0].split('/').at(-1);
    const read = () => page.evaluate(id => window.__OS__.content.query(`content://contacts/contacts/${id}`).items[0], id);
    const before = await read(); const selector = `${app} .contacts-detail-footer [data-action="contacts.contact.favorite.toggle"]`;
    await hit(page, selector); await page.waitForFunction(id => !window.__OS__.content.query(`content://contacts/contacts/${id}`).items[0].starred, {}, id);
    assert.equal(await route(page), state.route); await hit(page, selector);
    await page.waitForFunction(id => !!window.__OS__.content.query(`content://contacts/contacts/${id}`).items[0].starred, {}, id);
    const restored = await read();
    // The real ContactsProvider stamps updatedAt on an intentional favorite write.
    assert.deepEqual({ ...restored, updatedAt: before.updatedAt }, before);
    const retained = await page.$(selector); await openPilotApp(page, 'clock', '/world'); await retained.evaluate(e => e.click());
    assert.deepEqual(await read(), restored); assert.equal(await route(page), state.route); await retained.dispose();
  });
  await run('cold-favorite-menu-back', async page => {
    await start(page, 'en', 'unfolded', '/contacts?fav=true'); const state = await openFirstContact(page);
    await page.evaluate(() => window.__OS__.closeApp('contacts'));
    await openPilotApp(page, 'contacts', state.route + '&menu=more');
    await page.waitForSelector(`${app} [data-scroll-container="menu"]`, { visible: true });
    await page.evaluate(() => window.__OS__.handleBack()); await expectDetail(page, state.route);
  });
  await run('favorite-delete-returns-to-favorites', async page => {
    await start(page, 'en', 'unfolded', '/contacts?fav=true'); const state = await openFirstContact(page);
    const id = state.route.split('?')[0].split('/').at(-1);
    const before = await page.evaluate(() => window.__OS__.content.query('content://contacts/contacts').items);
    await hit(page, `${app} [data-trigger="contact.delete.open"]`);
    await page.waitForSelector(`${app} [role="alertdialog"]`, { visible: true });
    assert.equal((await route(page)).includes('fav=true'), true);
    await hit(page, `${app} [data-action="contacts.contact.delete.submit"]`);
    await page.waitForFunction(() => window.__OS__.getAppRoute('contacts').path === '/contacts?fav=true');
    assert.deepEqual(await page.evaluate(() => window.__OS__.content.query('content://contacts/contacts').items), before.filter(c => c.id !== id));
    await page.evaluate(() => window.__OS__.handleBack());
    assert.equal((await route(page)).includes(`/contact/${id}`), false);
  });
  await run('favorite-primary-sms-compose-and-back', async page => {
    await start(page, 'zh-Hans', 'unfolded', '/contacts?fav=true'); const state = await openFirstContact(page);
    const id = state.route.split('?')[0].split('/').at(-1);
    const address = await page.evaluate(id => {
      const contact = window.__OS__.content.query(`content://contacts/contacts/${id}`).items[0];
      return (contact.phones.find(phone => phone.isPrimary) ?? contact.phones[0]).number.replace(/\s+/g, '');
    }, id);
    await hit(page, `${app} .contacts-reference-actions [data-action="contacts.contact.sms.open"]`);
    await page.waitForFunction(() => window.__OS__.getState().activeAppId === 'sms');
    assert.equal(await page.evaluate(() => window.__OS__.getIntentPayload()?.data.address), address);
    await page.waitForFunction(address => [...document.querySelectorAll('[data-app-id="sms"] [data-benchmark-field="sms-recipient"]')].some(e => e.checkVisibility() && e.value.replace(/\s+/g, '') === address), {}, address);
    if (await page.evaluate(() => window.__OS__.keyboard.isVisible())) {
      await page.evaluate(() => window.__OS__.handleBack()); await page.waitForFunction(() => !window.__OS__.keyboard.isVisible());
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    }
    await page.evaluate(() => window.__OS__.handleBack());
    await page.waitForFunction(() => window.__OS__.getState().activeAppId === 'contacts'); await expectDetail(page, state.route);
  });
  for (const locale of ['zh-Hans', 'en']) for (const posture of ['folded', 'unfolded']) for (const favorite of [false, true]) await run(`${locale}-${posture}-${favorite ? 'favorite' : 'directory'}-call-detail-preserves-scroll-and-owner`, async page => {
    await start(page, locale, posture, favorite ? '/contacts?fav=true' : '/contacts');
    const id = await page.evaluate(() => window.__OS__.content.insert('content://contacts/contacts', {
      displayName: 'Disposable call scroll QA', phones: [{ id: 'scroll-phone', label: 'Mobile', number: '19943584333', isPrimary: true }],
      notes: Array.from({ length: 80 }, (_, index) => `scroll note ${index + 1}`).join('\n'), emails: [], starred: true,
    }).split('/').at(-1));
    const source = `/contact/${id}${favorite ? '?fav=true' : ''}`;
    await openPilotApp(page, 'contacts', source);
    await page.waitForFunction(source => window.__OS__.getAppRoute('contacts').path === source
      && document.querySelector('[data-app-id="contacts"] .contacts-reference-detail')?.checkVisibility(), {}, source);
    const scroll = `${app} .contacts-reference-detail [data-scroll-container="main"]`;
    const bounds = await page.$eval(scroll, element => element.getBoundingClientRect().toJSON());
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); await page.mouse.wheel({ deltaY: 5000 });
    await page.waitForFunction(selector => {
      const element = document.querySelector(selector);
      return element && element.scrollTop > 0 && Math.abs(element.scrollTop - (element.scrollHeight - element.clientHeight)) < 2;
    }, {}, scroll);
    const before = await page.$eval(scroll, element => element.scrollTop);
    assert.ok(before > 0);
    await hit(page, `${app} [data-trigger="contact.call.open"]`);
    await page.waitForFunction(() => window.__OS__.getAppRoute('contacts').path.startsWith('/call/'));
    await page.evaluate(() => window.__OS__.handleBack());
    await page.waitForFunction(source => window.__OS__.getAppRoute('contacts').path === source
      && document.querySelector('[data-app-id="contacts"] .contacts-reference-detail')?.checkVisibility(), {}, source);
    const after = await page.$eval(scroll, element => element.scrollTop);
    callScrollMeasurements.push({ locale, posture, origin: favorite ? 'favorite' : 'directory', before, after });
    assert.ok(after > 0 && Math.abs(after - before) < 4, `scroll changed ${before} -> ${after}`);
    const retained = await page.$(`${app} [data-trigger="contact.call.open"]`); await openPilotApp(page, 'clock', '/world'); await retained.evaluate(element => element.click());
    assert.equal(await route(page), source); await retained.dispose();
  });
  await run('detail-navigation-rejects-background-modal-and-stale-source', async page => {
    await start(page, 'en', 'unfolded', '/contacts?fav=true');
    const id = await page.evaluate(() => window.__OS__.content.insert('content://contacts/contacts', {
      displayName: 'Disposable detail links QA', phones: [{ id: 'link-phone', label: 'Mobile', number: '19943584333', isPrimary: true }], emails: [], starred: true,
    }).split('/').at(-1));
    const source = `/contact/${id}?fav=true`;
    const before = await page.evaluate(() => window.__OS__.content.query('content://contacts/contacts').items);
    for (const trigger of ['contact.edit.open', 'contact.menu.open', 'contact.delete.open', 'contact.dial.open', 'contact.call.open']) {
      await openPilotApp(page, 'contacts', source); await expectDetail(page, source);
      const controls = await page.$$(`${app} [data-trigger="${trigger}"]`);
      const retained = await (async () => { for (const control of controls) if (await control.evaluate(e => e.checkVisibility())) return control; throw Error(`Missing ${trigger}`); })();
      await openPilotApp(page, 'clock', '/world'); await retained.evaluate(e => e.click());
      assert.equal(await route(page), source); assert.equal(await page.evaluate(() => window.__OS__.getState().activeAppId), 'clock');
      assert.deepEqual(await page.evaluate(() => window.__OS__.content.query('content://contacts/contacts').items), before);
      for (const control of controls) await control.dispose();
    }
    await openPilotApp(page, 'contacts', source); await expectDetail(page, source);
    await page.evaluate(() => {
      const root = document.querySelector('[data-app-id="contacts"]'), call = root.querySelector('[data-trigger="contact.call.open"]');
      root.querySelector('.contacts-detail-footer [data-trigger="contact.menu.open"]').click();
      call.click();
    });
    await page.waitForFunction(() => window.__OS__.getAppRoute('contacts').path.includes('menu=more'));
    assert.equal((await route(page)).startsWith('/call/'), false);
    await page.evaluate(() => window.__OS__.handleBack()); await expectDetail(page, source);
    await page.evaluate(id => {
      const call = document.querySelector('[data-app-id="contacts"] [data-trigger="contact.call.open"]');
      window.__OS__.content.update(`content://contacts/contacts/${id}`, { notes: 'Controlled provider revision' });
      call.click();
    }, id);
    assert.equal(await route(page), source);
  });
} finally {
  await browser.close();
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: !failures.length && !errors.length && !writes.length,
    url: url.href, checks, failures, errors, writes, callScrollMeasurements,
    scope: 'Contacts Personal Favorites to full-width detail; locale/posture, Back, edit origin continuity and directory regression; not QR/video/ringtone implementation or whole-web parity' }, null, 2));
}
console.log(JSON.stringify({ output, checks, failures, errors, writes, callScrollMeasurements }, null, 2));
assert.deepEqual(failures, []); assert.deepEqual(errors, []); assert.deepEqual(writes, []);
