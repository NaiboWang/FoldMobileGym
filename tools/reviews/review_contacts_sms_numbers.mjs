// Disposable local recipient/draft review. No Send/Delete, model call or real SMS.
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
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3323/');
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && !url.username && !url.password);
const output = fs.mkdtempSync(path.join(root, 'artifacts/contacts-sms-numbers-'));
const browser = await require('puppeteer').launch({ headless: true, executablePath: resolveBrowserExecutable() });
const app = '[data-app-id="contacts"]', sms = '[data-app-id="sms"]', picker = `${app} .contacts-sms-number-picker`;
const recipient = `${sms} [data-benchmark-field="sms-recipient"]`, body = `${sms} [data-benchmark-field="sms-body"]`;
const checks = [], failures = [], errors = [], writes = [];
const selectedCase = process.env.FOLDAGENT_REVIEW_CASE || null;
const route = p => p.evaluate(() => window.__OS__.getAppRoute('contacts').path);
async function visible(p, selector) {
  await p.waitForFunction(s => [...document.querySelectorAll(s)].some(e => e.checkVisibility()), {}, selector);
  for (const handle of await p.$$(selector)) { if (await handle.evaluate(e => e.checkVisibility())) return handle; await handle.dispose(); }
  throw Error('No visible control: ' + selector);
}
async function hit(p, selector) {
  await p.waitForFunction(async s => {
    const e = [...document.querySelectorAll(s)].find(e => e.checkVisibility() && !e.disabled); if (!e) return false;
    const a = e.getBoundingClientRect(); await new Promise(r => requestAnimationFrame(r));
    const b = e.getBoundingClientRect(), target = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    return Math.abs(a.x - b.x) < .5 && Math.abs(a.y - b.y) < .5 && (target === e || e.contains(target));
  }, {}, selector);
  const h = await visible(p, selector); try { await h.click(); } finally { await h.dispose(); }
}
async function value(p, selector) { const h = await visible(p, selector); try { return await h.evaluate(e => e.value); } finally { await h.dispose(); } }
async function type(p, selector, text) { await hit(p, selector); await p.keyboard.type(text); }
const hideKeyboard = p => p.evaluate(() => { document.activeElement?.blur(); window.__OS__.keyboard.hide(); });
const facts = p => p.evaluate(() => {
  const content = window.__OS__.content, conversations = content.query('content://sms/conversations').items;
  return { contacts: content.query('content://contacts/contacts').items, conversations,
    messages: conversations.map(c => content.query(`content://sms/messages?conversationId=${c.id}`).items) };
});
async function ready(p, locale = 'zh-Hans', posture = 'unfolded', warm = false) {
  await p.setViewport({ width: 1440, height: 1100 }); await p.goto(url.href, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__OS__ && window.__SIM__ && window.__FOLDAGENT__);
  await p.evaluate(({ locale, posture }) => {
    window.__OS__.locale.setLocale(locale); window.__FOLDAGENT__.setPosture(posture);
    window.__smsNumberReviewOutgoing = []; window.addEventListener('sms-outgoing', e => window.__smsNumberReviewOutgoing.push(e.detail));
  }, { locale, posture });
  if (warm) { await openPilotApp(p, 'sms', '/new'); await type(p, body, 'General draft retained'); await hideKeyboard(p); await p.evaluate(() => window.__OS__.goHome()); }
  await openPilotApp(p, 'contacts', '/contacts');
  return p.evaluate(() => {
    const add = data => window.__OS__.content.insert('content://contacts/contacts', data).split('/').pop();
    return { multi: add({ displayName: 'Local number choice QA', phones: [
      { id: 'work', label: 'Work', number: '10 086' }, { id: 'primary', label: 'Mobile', number: '123 06', isPrimary: true },
      { id: 'duplicate', label: 'Home', number: '12306' }, { id: 'blank', label: 'Other', number: '   ' },
    ], emails: [] }), single: add({ displayName: 'Local single number QA', phones: [{ id: 'only', label: 'Mobile', number: '123 06' }], emails: [] }),
      empty: add({ displayName: 'Local no number QA', phones: [], emails: [] }) };
  });
}
async function detail(p, id, favorite = false, extra = '') {
  const target = `/contact/${id}` + (favorite ? '?fav=true' : '') + extra;
  await p.evaluate(target => window.__OS__.openApp('contacts', target), target);
  await p.waitForFunction(({ target, id }) => window.__OS__.getAppRoute('contacts').path === target
    && document.querySelector(`[data-app-id="contacts"] [data-benchmark-source-id="${id}"]`)?.checkVisibility(), {}, { target, id });
  return target;
}
async function openPicker(p) { await hit(p, `${app} [data-trigger="contact.sms.picker.open"]`); await visible(p, picker); }
async function pick(p, address) {
  await hit(p, `${picker} [data-contacts-sms-number="${address}"]`);
  await p.waitForFunction(({ recipient, address }) => [...document.querySelectorAll(recipient)].some(e => e.checkVisibility() && e.value === address), {}, { recipient, address });
  await p.waitForSelector(picker, { hidden: true });
}
async function returnToDetail(p, target) {
  await hideKeyboard(p); await p.evaluate(() => window.__OS__.handleBack());
  await p.waitForFunction(target => window.__OS__.getAppRoute('contacts').path === target
    && !document.querySelector('[data-app-id="contacts"] .contacts-sms-number-picker')
    && window.__OS__.getState().tasks.find(t => t.taskId === window.__OS__.getState().activeTaskId)?.stack.at(-1)?.appId === 'contacts', {}, target);
  await p.evaluate(() => new Promise(r => requestAnimationFrame(r)));
}
async function geometry(p) {
  return p.evaluate(picker => {
    const dialog = document.querySelector(picker), owner = dialog.closest('[data-app-id]');
    const a = dialog.getBoundingClientRect(), b = owner.getBoundingClientRect();
    return { inside: a.left >= b.left && a.right <= b.right && a.top >= b.top && a.bottom <= b.bottom,
      inert: !!owner.querySelector('[inert]'), focus: dialog.contains(document.activeElement) };
  }, picker);
}
async function run(name, fn) {
  if (selectedCase && name !== selectedCase) return;
  const context = await browser.createBrowserContext(), p = await context.newPage();
  p.on('pageerror', error => errors.push({ name, error: String(error) }));
  p.on('request', request => { if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) writes.push({ name, method: request.method(), url: request.url() }); });
  try { await fn(p); assert.deepEqual(await p.evaluate(() => window.__smsNumberReviewOutgoing ?? []), []); checks.push(name); console.log('PASS ' + name); }
  catch (error) { failures.push({ name, error: String(error.stack) }); console.error('FAIL ' + name + ': ' + error.stack); await p.screenshot({ path: path.join(output, `${name}-failure.png`) }).catch(() => {}); }
  finally { await context.close(); }
}
try {
  for (const locale of ['zh-Hans', 'en']) for (const posture of ['folded', 'unfolded']) for (const favorite of [false, true]) {
    const name = `${locale}-${posture}-${favorite ? 'favorite' : 'directory'}-recipients-drafts-return`;
    await run(name, async p => {
      const ids = await ready(p, locale, posture, true), target = await detail(p, ids.multi, favorite), before = await facts(p);
      await openPicker(p); assert.deepEqual(await geometry(p), { inside: true, inert: true, focus: true });
      assert.deepEqual(await p.$$eval(`${picker} [data-contacts-sms-number]`, es => es.map(e => e.dataset.contactsSmsNumber)), ['12306', '10086']);
      await p.keyboard.press('Tab'); assert.equal((await geometry(p)).focus, true);
      await p.keyboard.down('Shift'); await p.keyboard.press('Tab'); await p.keyboard.up('Shift'); assert.equal((await geometry(p)).focus, true);
      await p.keyboard.press('Escape'); await p.waitForSelector(picker, { hidden: true });
      await p.waitForFunction(target => window.__OS__.getAppRoute('contacts').path === target, {}, target);
      assert.equal(await p.evaluate(() => document.activeElement?.dataset.trigger), 'contact.sms.picker.open');
      await openPicker(p); await p.screenshot({ path: path.join(output, `${name}-picker.png`) }); await pick(p, '10086');
      assert.equal(await value(p, body), ''); await type(p, body, 'Secondary draft\nKeep this text'); await hideKeyboard(p);
      await p.evaluate(posture => window.__FOLDAGENT__.setPosture(posture === 'folded' ? 'unfolded' : 'folded'), posture);
      assert.equal(await value(p, recipient), '10086'); assert.equal(await value(p, body), 'Secondary draft\nKeep this text');
      await returnToDetail(p, target); await openPicker(p); await pick(p, '12306');
      assert.equal(await value(p, body), ''); await type(p, body, 'Primary draft'); await returnToDetail(p, target);
      await openPicker(p); await pick(p, '10086'); assert.equal(await value(p, body), 'Secondary draft\nKeep this text'); await returnToDetail(p, target);
      await p.evaluate(() => window.__OS__.goHome()); await openPilotApp(p, 'sms', '/new'); assert.equal(await value(p, body), 'General draft retained');
      await hideKeyboard(p); await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => window.__SIM__ && window.__OS__);
      await openPilotApp(p, 'contacts', target); await visible(p, `${app} [data-benchmark-source-id="${ids.multi}"]`);
      await openPicker(p); await pick(p, '12306'); assert.equal(await value(p, body), 'Primary draft'); await returnToDetail(p, target);
      assert.deepEqual(await facts(p), before, 'Recipient/draft editing must not send or change contacts/conversations/messages');
    });
  }
  await run('single-and-empty-contact-do-not-invent-picker-or-recipient', async p => {
    const ids = await ready(p), target = await detail(p, ids.single), before = await facts(p);
    assert.equal(await p.$(`${app} [data-trigger="contact.sms.picker.open"]`), null);
    await hit(p, `${app} .contacts-reference-actions [data-action="contacts.contact.sms.open"]`);
    assert.equal(await value(p, recipient), '12306'); await returnToDetail(p, target);
    await detail(p, ids.empty); assert.equal(await p.$eval(`${app} .contacts-reference-actions [data-action="contacts.contact.sms.open"]`, e => e.disabled), true);
    assert.deepEqual(await facts(p), before);
  });
  await run('explicit-incoming-text-does-not-replace-ordinary-recipient-or-general-draft', async p => {
    const ids = await ready(p, 'en', 'unfolded', true), target = await detail(p, ids.multi), before = await facts(p);
    await openPicker(p); await pick(p, '12306'); await type(p, body, 'Ordinary recipient draft'); await returnToDetail(p, target);
    await p.evaluate(() => window.__OS__.startActivity({ action: 'ACTION_VIEW', scheme: 'sms', data: { address: '12306', body: '999' } }));
    assert.equal(await value(p, recipient), '12306'); assert.equal(await value(p, body), '999'); await returnToDetail(p, target);
    await openPicker(p); await pick(p, '12306'); assert.equal(await value(p, body), 'Ordinary recipient draft'); await returnToDetail(p, target);
    await p.evaluate(() => window.__OS__.goHome()); await openPilotApp(p, 'sms', '/new'); assert.equal(await value(p, body), 'General draft retained');
    assert.deepEqual(await facts(p), before);
  });
  await run('external-detail-switch-does-not-focus-another-contact-message', async p => {
    const ids = await ready(p), before = await facts(p); await detail(p, ids.multi); await openPicker(p);
    await detail(p, ids.single); await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    assert.notEqual(await p.evaluate(() => document.activeElement?.closest('[data-benchmark-source-id]')?.getAttribute('data-benchmark-source-id')), ids.single);
    assert.deepEqual(await facts(p), before);
  });
  for (const favorite of [false, true]) await run(`${favorite ? 'favorite' : 'directory'}-stale-background-dismiss-source-guards`, async p => {
    const ids = await ready(p), target = await detail(p, ids.multi, favorite); await openPicker(p);
    const retained = await p.$(`${picker} [data-contacts-sms-number="10086"]`);
    const before = await facts(p), pickerRoute = await route(p);
    await openPilotApp(p, 'clock', '/world'); await retained.evaluate(e => e.click());
    assert.equal(await route(p), pickerRoute); assert.deepEqual(await facts(p), before);
    assert.equal(await p.evaluate(() => window.__OS__.getState().tasks.find(t => t.taskId === window.__OS__.getState().activeTaskId)?.rootAppId), 'clock');
    await p.evaluate(() => window.__OS__.launchTaskById(window.__OS__.getState().tasks.find(t => t.rootAppId === 'contacts').taskId));
    await retained.evaluate(e => { window.__OS__.handleBack(); e.click(); }); await p.waitForSelector(picker, { hidden: true });
    assert.equal(await route(p), target); assert.deepEqual(await facts(p), before); await retained.dispose();
    await p.evaluate(() => new Promise(r => requestAnimationFrame(r))); await openPicker(p);
    const count = await p.evaluate(() => window.__OS__.getState().tasks.flatMap(t => t.stack).filter(a => a.appId === 'sms').length);
    const twice = await p.$(`${picker} [data-contacts-sms-number="10086"]`);
    await twice.evaluate(e => { e.click(); e.click(); }); await visible(p, recipient);
    assert.equal(await value(p, recipient), '10086');
    assert.equal(await p.evaluate(() => window.__OS__.getState().tasks.flatMap(t => t.stack).filter(a => a.appId === 'sms').length), count + 1);
    await returnToDetail(p, target); await twice.dispose();
    await p.evaluate(() => new Promise(r => requestAnimationFrame(r))); await openPicker(p);
    const stale = await p.$(`${picker} [data-contacts-sms-number="10086"]`);
    await stale.evaluate((e, id) => { window.__OS__.content.update(`content://contacts/contacts/${id}`, { phones: [{ id: 'replacement', label: 'Work', number: '12306' }] }); e.click(); }, ids.multi);
    await p.waitForFunction(picker => [...document.querySelectorAll(`${picker} [data-contacts-sms-number]`)].every(e => e.disabled), {}, picker);
    assert.equal(await p.evaluate(() => document.activeElement?.classList.contains('contacts-sms-number-cancel')), true);
    assert.equal(await route(p), pickerRoute); assert.equal(await p.evaluate(() => window.__OS__.getState().tasks.find(t => t.taskId === window.__OS__.getState().activeTaskId)?.stack.at(-1)?.appId), 'contacts');
    await p.keyboard.press('Escape'); await p.waitForSelector(picker, { hidden: true }); await stale.dispose();
  });
  for (const favorite of [false, true]) for (const deleted of [false, true]) await run(`stale-picker-${favorite ? 'favorite' : 'directory'}-${deleted ? 'deleted' : 'changed'}-in-background`, async p => {
    const ids = await ready(p), target = await detail(p, ids.multi, favorite); await openPicker(p);
    await openPilotApp(p, 'clock', '/world');
    await p.evaluate(({ id, deleted }) => { const uri = `content://contacts/contacts/${id}`;
      if (deleted) window.__OS__.content.delete(uri);
      else window.__OS__.content.update(uri, { phones: [{ id: 'replacement', label: 'Work', number: '12306' }] });
    }, { id: ids.multi, deleted });
    assert.equal(await p.evaluate(() => window.__OS__.getState().tasks.find(t => t.taskId === window.__OS__.getState().activeTaskId)?.rootAppId), 'clock');
    assert.notEqual(await p.evaluate(() => document.activeElement?.closest('[data-app-id]')?.getAttribute('data-app-id')), 'contacts');
    await p.evaluate(() => window.__OS__.launchTaskById(window.__OS__.getState().tasks.find(t => t.rootAppId === 'contacts').taskId));
    await p.waitForFunction(() => document.activeElement?.classList.contains('contacts-sms-number-cancel'));
    await p.keyboard.press('Escape'); await p.waitForSelector(picker, { hidden: true }); assert.equal(await route(p), target);
  });
  for (const missing of [false, true]) await run(`cold-${missing ? 'missing' : 'existing'}-source-back-owns-detail`, async p => {
    const ids = await ready(p), id = missing ? 'absent-local-qa' : ids.multi, target = `/contact/${id}?fav=true&q=local`;
    await p.evaluate(target => window.__OS__.openApp('contacts', target + '&modal=sms'), target); await visible(p, picker);
    if (missing) assert.equal(await p.$$eval(`${picker} [data-contacts-sms-number]`, es => es.length), 0);
    if (missing) await hit(p, `${picker} .contacts-sms-number-cancel`);
    else await p.evaluate(() => window.__OS__.handleBack());
    await p.waitForSelector(picker, { hidden: true });
    await p.waitForFunction(target => window.__OS__.getAppRoute('contacts').path === target, {}, target);
  });
  await run('stacked-0.3-long-name-scrolls-to-message-action', async p => {
    const ids = await ready(p); await p.evaluate(id => window.__OS__.content.update(`content://contacts/contacts/${id}`, {
      displayName: 'Long synthetic contact name '.repeat(8), company: 'Synthetic organization '.repeat(5),
    }), ids.multi);
    await detail(p, ids.multi); await openPilotApp(p, 'clock', '/world');
    await p.evaluate(() => {
      const tasks = window.__OS__.getState().tasks, contacts = tasks.find(t => t.rootAppId === 'contacts'), clock = tasks.find(t => t.rootAppId === 'clock');
      window.__FOLDAGENT__.setMultiWindow('split', contacts.taskId, clock.taskId, .3, null, .5, 'stacked'); window.__OS__.launchTaskById(contacts.taskId);
    });
    await p.waitForSelector(`${app} [data-trigger="contact.sms.picker.open"]`);
    await p.evaluate(selector => document.querySelector(selector).scrollIntoView({ block: 'center' }), `${app} [data-trigger="contact.sms.picker.open"]`);
    await openPicker(p); assert.equal((await geometry(p)).inside, true);
  });
  for (const [orientation, ratio] of [['side_by_side', .5], ['stacked', .5], ['stacked', .4], ['stacked', .3]]) await run(`${orientation}-${ratio}-picker-contained-and-background-rejected`, async p => {
    const ids = await ready(p); await detail(p, ids.multi); await openPilotApp(p, 'clock', '/world');
    await p.evaluate(({ orientation, ratio }) => {
      const tasks = window.__OS__.getState().tasks, contacts = tasks.find(t => t.rootAppId === 'contacts'), clock = tasks.find(t => t.rootAppId === 'clock');
      window.__FOLDAGENT__.setMultiWindow('split', contacts.taskId, clock.taskId, ratio, null, .5, orientation); window.__OS__.launchTaskById(contacts.taskId);
    }, { orientation, ratio });
    await openPicker(p); assert.equal((await geometry(p)).inside, true);
    assert.equal(await p.evaluate(() => { const peer = document.querySelector('[data-app-id="clock"]').getBoundingClientRect();
      return document.elementFromPoint(peer.x + peer.width / 2, peer.y + peer.height / 2)?.closest('[data-app-id]')?.getAttribute('data-app-id'); }), 'clock');
    const retained = await p.$(`${picker} [data-contacts-sms-number="10086"]`), before = await facts(p);
    await p.evaluate(() => window.__OS__.launchTaskById(window.__OS__.getState().tasks.find(t => t.rootAppId === 'clock').taskId));
    await retained.evaluate(e => e.click()); assert.deepEqual(await facts(p), before); await retained.dispose();
  });
} finally {
  if (selectedCase && !checks.length && !failures.length) failures.push({ name: selectedCase, error: 'No matching diagnostic case was executed' });
  await browser.close(); fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: !failures.length && !errors.length && !writes.length,
    url: url.href, selectedCase, checks, failures, errors, writes, scope: 'Local contact number selection, borrowed SMS drafts and source/route ownership; no real SMS or native-picker pixel certification' }, null, 2));
  console.log(JSON.stringify({ passed: !failures.length && !errors.length && !writes.length, output, checks: checks.length, failures: failures.length, errors, writes }));
  if (failures.length || errors.length || writes.length) process.exitCode = 1;
}
